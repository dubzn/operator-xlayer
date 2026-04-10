import { ethers } from "ethers";
import { hashIntent, computeJobId } from "@x402-operator/shared";
import type { ExecutionIntent } from "@x402-operator/shared";
import { config, getOperatorWallet } from "../config.js";
import { OperatorVaultABI } from "../abi.js";
import type { CachedQuote } from "./quoteCache.js";

export interface ExecutionResult {
  jobId: string;
  txHash: string;
  amountOut: string;
}

export async function executeIntent(
  intent: ExecutionIntent,
  signature: string,
  paymentRef: string,
  cachedQuote: CachedQuote
): Promise<ExecutionResult> {
  const wallet = getOperatorWallet();
  const vault = new ethers.Contract(config.vaultAddress, OperatorVaultABI, wallet);

  const intentHash = hashIntent(intent);
  const paymentRefBytes = ethers.zeroPadValue(paymentRef, 32);
  const jobId = computeJobId(intentHash, paymentRefBytes);

  const intentTuple = [
    intent.vaultAddress,
    intent.controller,
    intent.adapter,
    intent.tokenIn,
    intent.tokenOut,
    intent.amountIn,
    intent.quotedAmountOut,
    intent.minAmountOut,
    intent.nonce,
    intent.deadline,
    intent.executionHash,
  ];

  const tx = await vault.executeSwap(
    intentTuple,
    cachedQuote.routeData,
    signature,
    paymentRefBytes,
    config.registryAddress
  );

  const receipt = await tx.wait();

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
      // ignore unrelated logs
    }
  }

  return {
    jobId,
    txHash: receipt.hash,
    amountOut,
  };
}
