import { ethers } from "ethers";
import { recoverIntentSigner } from "@x402-operator/shared";
import type { ExecutionIntent } from "@x402-operator/shared";
import { config, getProvider } from "../config.js";
import { OperatorVaultABI } from "../abi.js";

/**
 * Validates an ExecutionIntent offchain before spending gas.
 * The vault re-validates everything onchain — this is a gas-saving filter.
 */
export async function validateIntent(
  intent: ExecutionIntent,
  signature: string
): Promise<{ valid: true; controller: string } | { valid: false; error: string }> {
  // 1. Recover signer from EIP-712 signature
  let controller: string;
  try {
    controller = recoverIntentSigner(intent, signature);
  } catch {
    return { valid: false, error: "Invalid signature" };
  }

  const provider = getProvider();
  const vault = new ethers.Contract(config.vaultAddress, OperatorVaultABI, provider);

  // 2. Check controller is authorized
  const isAuthorized = await vault.authorizedControllers(controller);
  if (!isAuthorized) {
    return { valid: false, error: `Controller ${controller} is not authorized` };
  }

  // 3. Check nonce not used
  const nonceUsed = await vault.usedNonces(intent.nonce);
  if (nonceUsed) {
    return { valid: false, error: `Nonce ${intent.nonce} already used` };
  }

  // 4. Check deadline
  const block = await provider.getBlock("latest");
  if (block && block.timestamp > intent.deadline) {
    return { valid: false, error: "Intent has expired" };
  }

  // 5. Check tokens allowed
  const tokenInAllowed = await vault.allowedTokens(intent.tokenIn);
  const tokenOutAllowed = await vault.allowedTokens(intent.tokenOut);
  if (!tokenInAllowed || !tokenOutAllowed) {
    return { valid: false, error: "Token not in allowlist" };
  }

  // 6. Check amount
  const maxAmount = await vault.maxAmountPerTrade();
  if (BigInt(intent.amount) > maxAmount) {
    return { valid: false, error: `Amount exceeds max per trade (${maxAmount})` };
  }

  // 7. Check vault address matches
  if (intent.vaultAddress.toLowerCase() !== config.vaultAddress.toLowerCase()) {
    return { valid: false, error: "Vault address mismatch" };
  }

  return { valid: true, controller };
}
