import { recoverIntentSigner } from "@x402-operator/shared";
import type { ExecutionIntent } from "@x402-operator/shared";
import { config, getProvider } from "../config.js";
import { OperatorVaultABI } from "../abi.js";
import { ethers } from "ethers";

export interface IntentPolicySnapshot {
  blockTimestamp: number;
  controllerAuthorized: boolean;
  adapterAllowed: boolean;
  nonceUsed: boolean;
  inputTokenAllowed: boolean;
  tokenOutAllowed: boolean;
  pairAllowed: boolean;
  maxAmountPerTrade: bigint;
  maxDailyVolume: bigint;
  maxSlippageBps: bigint;
  currentDay: bigint;
  dailyVolumeUsed: bigint;
  lastExecution: bigint;
  cooldownSeconds: bigint;
  paused: boolean;
}

export interface PolicyCheckSummary {
  controllerAuthorized: boolean;
  adapterAllowed: boolean;
  nonceAvailable: boolean;
  inputTokenAllowed: boolean;
  outputTokenAllowed: boolean;
  pairAllowed: boolean;
  amountWithinLimit: boolean;
  withinDailyVolume: boolean;
  cooldownMet: boolean;
  vaultNotPaused: boolean;
  policyMinAmountOut: string;
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

  const controllerAuthorized = await vault.authorizedControllers(intent.controller);
  const adapterAllowed = await vault.allowedSwapAdapters(intent.adapter);
  const nonceUsed = await vault.usedNonces(intent.nonce);
  const inputTokenAllowed = await vault.allowedInputTokens(intent.tokenIn);
  const tokenOutAllowed = await vault.allowedTokens(intent.tokenOut);
  const pairAllowed = await vault.allowedPairs(intent.tokenIn, intent.tokenOut);
  const maxAmountPerTrade = await vault.maxAmountPerTrade();
  const maxDailyVolume = await vault.maxDailyVolume();
  const maxSlippageBps = await vault.maxSlippageBps();
  const currentDay = await vault.currentDay();
  const dailyVolumeUsed = await vault.dailyVolumeUsed();
  const lastExecution = await vault.lastExecution();
  const cooldownSeconds = await vault.cooldownSeconds();
  const paused = await vault.paused();

  return {
    blockTimestamp: block.timestamp,
    controllerAuthorized,
    adapterAllowed,
    nonceUsed,
    inputTokenAllowed,
    tokenOutAllowed,
    pairAllowed,
    maxAmountPerTrade: BigInt(maxAmountPerTrade),
    maxDailyVolume: BigInt(maxDailyVolume),
    maxSlippageBps: BigInt(maxSlippageBps),
    currentDay: BigInt(currentDay),
    dailyVolumeUsed: BigInt(dailyVolumeUsed),
    lastExecution: BigInt(lastExecution),
    cooldownSeconds: BigInt(cooldownSeconds),
    paused,
  };
}

export function buildPolicyCheckSummary(
  intent: ExecutionIntent,
  snapshot: IntentPolicySnapshot,
  quotedAmountOutOverride?: bigint
): PolicyCheckSummary {
  const today = BigInt(Math.floor(snapshot.blockTimestamp / 86400));
  const effectiveDailyUsed = today === snapshot.currentDay ? snapshot.dailyVolumeUsed : 0n;
  const amount = BigInt(intent.amountIn);
  const cooldownDeadline = snapshot.lastExecution + snapshot.cooldownSeconds;
  const quotedAmountOut = quotedAmountOutOverride ?? BigInt(intent.quotedAmountOut || "0");
  const policyMinAmountOut = (quotedAmountOut * (10_000n - snapshot.maxSlippageBps)) / 10_000n;

  return {
    controllerAuthorized: snapshot.controllerAuthorized,
    adapterAllowed: snapshot.adapterAllowed,
    nonceAvailable: !snapshot.nonceUsed,
    inputTokenAllowed: snapshot.inputTokenAllowed,
    outputTokenAllowed: snapshot.tokenOutAllowed,
    pairAllowed: snapshot.pairAllowed,
    amountWithinLimit: amount <= snapshot.maxAmountPerTrade,
    withinDailyVolume:
      snapshot.maxDailyVolume === 0n || effectiveDailyUsed + amount <= snapshot.maxDailyVolume,
    cooldownMet:
      snapshot.cooldownSeconds === 0n ||
      snapshot.lastExecution === 0n ||
      BigInt(snapshot.blockTimestamp) >= cooldownDeadline,
    vaultNotPaused: !snapshot.paused,
    policyMinAmountOut: policyMinAmountOut.toString(),
  };
}

export async function validateIntent(
  intent: ExecutionIntent,
  signature: string
): Promise<{ valid: true; controller: string } | { valid: false; error: string }> {
  if (intent.vaultAddress.toLowerCase() !== config.vaultAddress.toLowerCase()) {
    return { valid: false, error: "Vault address mismatch" };
  }

  if (intent.adapter.toLowerCase() !== config.swapAdapterAddress.toLowerCase()) {
    return { valid: false, error: "Unsupported swap adapter for this operator" };
  }

  let controller: string;
  try {
    controller = recoverIntentSigner(intent, signature);
  } catch {
    return { valid: false, error: "Invalid signature" };
  }

  if (controller.toLowerCase() !== intent.controller.toLowerCase()) {
    return { valid: false, error: "Controller field does not match recovered signer" };
  }

  if (intent.executionHash === ethers.ZeroHash) {
    return { valid: false, error: "Execution hash missing" };
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

  if (!summary.controllerAuthorized) {
    return { valid: false, error: `Controller ${controller} is not authorized` };
  }

  if (!summary.adapterAllowed) {
    return { valid: false, error: "Selected swap adapter is not allowlisted on the vault" };
  }

  if (!summary.nonceAvailable) {
    return { valid: false, error: `Nonce ${intent.nonce} already used` };
  }

  if (snapshot.blockTimestamp > intent.deadline) {
    return { valid: false, error: "Intent has expired" };
  }

  if (!summary.inputTokenAllowed) {
    return { valid: false, error: "tokenIn not in allowlist" };
  }

  if (!summary.outputTokenAllowed) {
    return { valid: false, error: "tokenOut not in allowlist" };
  }

  if (!summary.pairAllowed) {
    return { valid: false, error: "token pair not in allowlist" };
  }

  if (!summary.vaultNotPaused) {
    return { valid: false, error: "Vault is paused" };
  }

  if (!summary.amountWithinLimit) {
    return { valid: false, error: `Amount exceeds max per trade (${snapshot.maxAmountPerTrade})` };
  }

  if (!summary.withinDailyVolume) {
    return { valid: false, error: "Daily volume cap would be exceeded" };
  }

  if (!summary.cooldownMet) {
    return { valid: false, error: "Vault cooldown not met yet" };
  }

  if (BigInt(intent.minAmountOut) < BigInt(summary.policyMinAmountOut)) {
    return { valid: false, error: "minAmountOut is below the vault slippage floor" };
  }

  return { valid: true, controller };
}
