import { ethers } from "ethers";
import { recoverIntentSigner } from "@x402-operator/shared";
import type { ExecutionIntent } from "@x402-operator/shared";
import { config, getProvider } from "../config.js";
import { OperatorVaultABI } from "../abi.js";

export interface IntentPolicySnapshot {
  blockTimestamp: number;
  controllerAuthorized: boolean;
  nonceUsed: boolean;
  tokenOutAllowed: boolean;
  baseToken: string;
  maxAmountPerTrade: bigint;
  maxDailyVolume: bigint;
  maxSlippageBps: bigint;
  currentDay: bigint;
  dailyVolumeUsed: bigint;
  lastExecution: bigint;
  cooldownSeconds: bigint;
  paused: boolean;
  trustedRouter: string;
}

export interface PolicyCheckSummary {
  controllerAuthorized: boolean;
  nonceAvailable: boolean;
  tokenInMatchesBaseToken: boolean;
  tokenOutAllowed: boolean;
  amountWithinLimit: boolean;
  withinDailyVolume: boolean;
  cooldownMet: boolean;
  vaultNotPaused: boolean;
  effectiveMaxSlippageBps: number;
}

export async function readIntentPolicySnapshot(
  intent: ExecutionIntent
): Promise<IntentPolicySnapshot> {
  const provider = getProvider();
  const vault = new ethers.Contract(config.vaultAddress, OperatorVaultABI, provider);
  const block = await provider.getBlock("latest");

  if (!block) {
    throw new Error("Failed to fetch latest block for validation");
  }

  const [
    controllerAuthorized,
    nonceUsed,
    tokenOutAllowed,
    baseToken,
    maxAmountPerTrade,
    maxDailyVolume,
    maxSlippageBps,
    currentDay,
    dailyVolumeUsed,
    lastExecution,
    cooldownSeconds,
    paused,
    trustedRouter,
  ] = await Promise.all([
    vault.authorizedControllers(intent.controller),
    vault.usedNonces(intent.nonce),
    vault.allowedTokens(intent.tokenOut),
    vault.baseToken(),
    vault.maxAmountPerTrade(),
    vault.maxDailyVolume(),
    vault.maxSlippageBps(),
    vault.currentDay(),
    vault.dailyVolumeUsed(),
    vault.lastExecution(),
    vault.cooldownSeconds(),
    vault.paused(),
    vault.trustedRouter(),
  ]);

  return {
    blockTimestamp: block.timestamp,
    controllerAuthorized,
    nonceUsed,
    tokenOutAllowed,
    baseToken: String(baseToken),
    maxAmountPerTrade: BigInt(maxAmountPerTrade),
    maxDailyVolume: BigInt(maxDailyVolume),
    maxSlippageBps: BigInt(maxSlippageBps),
    currentDay: BigInt(currentDay),
    dailyVolumeUsed: BigInt(dailyVolumeUsed),
    lastExecution: BigInt(lastExecution),
    cooldownSeconds: BigInt(cooldownSeconds),
    paused,
    trustedRouter: String(trustedRouter),
  };
}

export function buildPolicyCheckSummary(
  intent: ExecutionIntent,
  snapshot: IntentPolicySnapshot
): PolicyCheckSummary {
  const today = BigInt(Math.floor(snapshot.blockTimestamp / 86400));
  const effectiveDailyUsed = today === snapshot.currentDay ? snapshot.dailyVolumeUsed : 0n;
  const amount = BigInt(intent.amount);
  const cooldownDeadline = snapshot.lastExecution + snapshot.cooldownSeconds;
  const effectiveMaxSlippageBps = snapshot.maxSlippageBps < BigInt(intent.maxSlippageBps)
    ? snapshot.maxSlippageBps
    : BigInt(intent.maxSlippageBps);

  return {
    controllerAuthorized: snapshot.controllerAuthorized,
    nonceAvailable: !snapshot.nonceUsed,
    tokenInMatchesBaseToken: intent.tokenIn.toLowerCase() === snapshot.baseToken.toLowerCase(),
    tokenOutAllowed: snapshot.tokenOutAllowed,
    amountWithinLimit: amount <= snapshot.maxAmountPerTrade,
    withinDailyVolume:
      snapshot.maxDailyVolume === 0n || effectiveDailyUsed + amount <= snapshot.maxDailyVolume,
    cooldownMet:
      snapshot.cooldownSeconds === 0n ||
      snapshot.lastExecution === 0n ||
      BigInt(snapshot.blockTimestamp) >= cooldownDeadline,
    vaultNotPaused: !snapshot.paused,
    effectiveMaxSlippageBps: Number(effectiveMaxSlippageBps),
  };
}

/**
 * Validates an ExecutionIntent offchain before spending gas.
 * The vault re-validates everything onchain — this is a gas-saving filter.
 */
export async function validateIntent(
  intent: ExecutionIntent,
  signature: string
): Promise<{ valid: true; controller: string } | { valid: false; error: string }> {
  if (intent.vaultAddress.toLowerCase() !== config.vaultAddress.toLowerCase()) {
    return { valid: false, error: "Vault address mismatch" };
  }

  // 1. Recover signer from EIP-712 signature
  let controller: string;
  try {
    controller = recoverIntentSigner(intent, signature);
  } catch {
    return { valid: false, error: "Invalid signature" };
  }

  if (controller.toLowerCase() !== intent.controller.toLowerCase()) {
    return { valid: false, error: "Controller field does not match recovered signer" };
  }

  let snapshot: IntentPolicySnapshot;
  try {
    snapshot = await readIntentPolicySnapshot(intent);
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Failed to fetch vault policy snapshot",
    };
  }

  const summary = buildPolicyCheckSummary(intent, snapshot);

  // 2. Check controller is authorized
  if (!summary.controllerAuthorized) {
    return { valid: false, error: `Controller ${controller} is not authorized` };
  }

  // 3. Check nonce not used
  if (!summary.nonceAvailable) {
    return { valid: false, error: `Nonce ${intent.nonce} already used` };
  }

  // 4. Check deadline
  if (snapshot.blockTimestamp > intent.deadline) {
    return { valid: false, error: "Intent has expired" };
  }

  // 5. Check tokens
  if (!summary.tokenInMatchesBaseToken) {
    return { valid: false, error: "tokenIn must match vault baseToken" };
  }

  if (!summary.tokenOutAllowed) {
    return { valid: false, error: "tokenOut not in allowlist" };
  }

  if (!summary.vaultNotPaused) {
    return { valid: false, error: "Vault is paused" };
  }

  // 6. Check amount
  if (!summary.amountWithinLimit) {
    return { valid: false, error: `Amount exceeds max per trade (${snapshot.maxAmountPerTrade})` };
  }

  // 7. Check daily volume using same UTC day bucket semantics as the vault
  if (!summary.withinDailyVolume) {
    return { valid: false, error: "Daily volume cap would be exceeded" };
  }

  // 8. Check per-vault cooldown
  if (!summary.cooldownMet) {
    return { valid: false, error: "Vault cooldown not met yet" };
  }

  return { valid: true, controller };
}
