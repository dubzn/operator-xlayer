import { ethers } from "ethers";
import { hashIntent, computeJobId } from "@x402-operator/shared";
import type { ExecutionIntent } from "@x402-operator/shared";
import { config, getOperatorWallet } from "../config.js";
import { OperatorVaultABI } from "../abi.js";
import { getSwapQuote } from "./onchainos.js";

export interface ExecutionResult {
  jobId: string;
  txHash: string;
  amountOut: string;
}

/**
 * Executes a validated intent through the vault contract.
 *
 * Steps:
 * 1. Get swap quote/route from OnchainOS Trade
 * 2. Build and send vault.executeSwap() transaction
 * 3. Return jobId and txHash
 */
export async function executeIntent(
  intent: ExecutionIntent,
  signature: string,
  paymentRef: string
): Promise<ExecutionResult> {
  const wallet = getOperatorWallet();
  const vault = new ethers.Contract(config.vaultAddress, OperatorVaultABI, wallet);

  // 1. Get swap route from OnchainOS Trade
  const quote = await getSwapQuote(
    intent.tokenIn,
    intent.tokenOut,
    intent.amount,
    config.vaultAddress
  );

  // 2. Compute jobId for tracking
  const intentHash = hashIntent(intent);
  const paymentRefBytes = ethers.zeroPadValue(paymentRef, 32);
  const jobId = computeJobId(intentHash, paymentRefBytes);

  // 3. Call vault.executeSwap()
  const intentTuple = [
    intent.vaultAddress,
    intent.controller,
    intent.tokenIn,
    intent.tokenOut,
    intent.amount,
    intent.maxSlippageBps,
    intent.nonce,
    intent.deadline,
  ];

  // Compute minAmountOut from quote (Phase 2: use slippage bounds)
  const minAmountOut = 0; // TODO: compute from quote.expectedOut and effective slippage

  const tx = await vault.executeSwap(
    intentTuple,
    quote.routeData,
    signature,
    paymentRefBytes,
    config.registryAddress,
    minAmountOut
  );

  const receipt = await tx.wait();

  // 4. Parse ExecutionSucceeded event for amountOut
  let amountOut = "0";
  for (const log of receipt.logs) {
    try {
      const parsed = vault.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === "ExecutionSucceeded") {
        amountOut = parsed.args.amountOut.toString();
        break;
      }
    } catch {
      // not our event
    }
  }

  return {
    jobId,
    txHash: receipt.hash,
    amountOut,
  };
}
