import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import {
  computeExecutionHash,
  type ExecuteRequest,
  type ExecutionPreview,
  type PreviewRequest,
} from "@x402-operator/shared";
import { ExecutionRegistryABI } from "../abi.js";
import { config, getProvider } from "../config.js";
import { buildPaymentChallenge, verifyPayment } from "../middleware/x402.js";
import { consumePaymentReference } from "../services/paymentLedger.js";
import {
  buildPolicyCheckSummary,
  readIntentPolicySnapshot,
  validateIntent,
} from "../services/intentValidator.js";
import { executeIntent } from "../services/onchainExecutor.js";
import { getQuote, storeQuote } from "../services/quoteCache.js";
import { getSwapQuote, resolveRoutePreferences } from "../services/onchainos.js";
import { recordEvent } from "../services/indexer.js";

const router = Router();

router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { intent, routePreferences } = req.body as PreviewRequest;

    if (!intent) {
      res.status(400).json({ error: "Missing intent" });
      return;
    }

    if (intent.vaultAddress.toLowerCase() !== config.vaultAddress.toLowerCase()) {
      res.status(400).json({ error: "Vault address mismatch" });
      return;
    }

    const snapshot = await readIntentPolicySnapshot(intent);
    const appliedRoutePreferences = resolveRoutePreferences(routePreferences);
    const quote = await getSwapQuote(
      intent.tokenIn,
      intent.tokenOut,
      intent.amountIn,
      config.vaultAddress,
      appliedRoutePreferences
    );
    const summary = buildPolicyCheckSummary(intent, snapshot, BigInt(quote.expectedOut));

    const riskFlags: string[] = [];
    const warnings: string[] = [];

    if (intent.adapter.toLowerCase() !== config.swapAdapterAddress.toLowerCase()) {
      riskFlags.push("adapter-not-supported-by-operator");
      warnings.push("This operator currently only supports its configured OKX swap adapter.");
    }

    if (!summary.controllerAuthorized) {
      riskFlags.push("controller-not-authorized");
      warnings.push("The controller is not authorized on the vault right now.");
    }

    if (!summary.adapterAllowed) {
      riskFlags.push("adapter-not-allowlisted");
      warnings.push("The selected swap adapter is not allowlisted on the vault.");
    }

    if (!summary.nonceAvailable) {
      riskFlags.push("nonce-already-used");
      warnings.push("This nonce has already been consumed and cannot be replayed.");
    }

    if (snapshot.blockTimestamp > intent.deadline) {
      riskFlags.push("intent-already-expired");
      warnings.push("The provided deadline is already in the past.");
    }

    if (!summary.inputTokenAllowed) {
      riskFlags.push("token-in-not-allowed");
      warnings.push("The selected input token is not allowlisted on the vault.");
    }

    if (!summary.outputTokenAllowed) {
      riskFlags.push("token-out-not-allowed");
      warnings.push("The selected output token is not allowlisted on the vault.");
    }

    if (!summary.pairAllowed) {
      riskFlags.push("pair-not-allowed");
      warnings.push("The selected token pair is not allowlisted on the vault.");
    }

    if (!summary.amountWithinLimit) {
      riskFlags.push("max-amount-exceeded");
      warnings.push("The requested amount is above the single-trade cap.");
    }

    if (!summary.withinDailyVolume) {
      riskFlags.push("daily-volume-exceeded");
      warnings.push("This trade would exceed the vault daily volume cap.");
    }

    if (!summary.cooldownMet) {
      riskFlags.push("cooldown-not-met");
      warnings.push("The vault cooldown has not elapsed yet.");
    }

    if (!summary.vaultNotPaused) {
      riskFlags.push("vault-paused");
      warnings.push("The vault is currently paused.");
    }

    const executionHash = quote.routeData !== "0x"
      ? computeExecutionHash(quote.routeData)
      : ethers.ZeroHash;
    const expiresAt = Math.min(intent.deadline, snapshot.blockTimestamp + 60);

    if (quote.routeData === "0x") {
      riskFlags.push("route-not-ready");
      warnings.push("Route data is still stubbed, so this preview is informational only.");
    }

    if (quote.expectedOut === "0") {
      riskFlags.push("quote-missing");
      warnings.push("No executable quote is available yet from the trade integration.");
    }

    if (executionHash !== ethers.ZeroHash) {
      storeQuote(executionHash, {
        adapterAddress: config.swapAdapterAddress,
        routerAddress: quote.routerAddress,
        routeData: quote.routeData,
        expectedOut: quote.expectedOut,
        minAmountOut: summary.policyMinAmountOut,
        expiresAt,
      });
    }

    const preview: ExecutionPreview = {
      jobClass: "swap-v2",
      vaultAddress: intent.vaultAddress,
      estimatedFee: {
        amount: config.operatorFee,
        token: config.feeToken,
      },
      quotedRoute: {
        adapterAddress: config.swapAdapterAddress,
        routerAddress: quote.routerAddress,
        hasRouteData: quote.routeData !== "0x",
        expectedOut: quote.expectedOut,
        minAmountOut: summary.policyMinAmountOut,
        executionHash,
      },
      riskFlags,
      warnings,
      routePreferencesApplied: appliedRoutePreferences,
      policyCheckSummary: summary,
      expiresAt,
    };

    res.json(preview);
  } catch (err) {
    console.error("[preview] Error:", err);
    res.status(500).json({
      error: "Preview failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/execute", async (req: Request, res: Response) => {
  try {
    const { intent, signature, paymentReference } = req.body as ExecuteRequest;

    const cachedQuote = getQuote(intent.executionHash);
    if (!cachedQuote) {
      res.status(400).json({ error: "Preview quote missing or expired; preview again before executing" });
      return;
    }

    if (cachedQuote.adapterAddress.toLowerCase() !== intent.adapter.toLowerCase()) {
      res.status(400).json({ error: "Cached quote adapter does not match intent adapter" });
      return;
    }

    if (cachedQuote.expectedOut !== intent.quotedAmountOut) {
      res.status(400).json({ error: "Intent quotedAmountOut does not match cached quote" });
      return;
    }

    if (BigInt(intent.minAmountOut) < BigInt(cachedQuote.minAmountOut)) {
      res.status(400).json({ error: "Intent minAmountOut is below cached quote floor" });
      return;
    }

    const validation = await validateIntent(intent, signature);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    if (!paymentReference) {
      res.status(402).json(buildPaymentChallenge());
      return;
    }

    const paymentCheck = await verifyPayment(paymentReference, validation.controller);
    if (!paymentCheck.valid) {
      res.status(402).json({
        ...buildPaymentChallenge(),
        error: paymentCheck.error,
      });
      return;
    }

    if (!consumePaymentReference(paymentReference)) {
      res.status(409).json({
        error: "Payment reference already consumed",
      });
      return;
    }

    console.log(`[execute] Intent validated. Controller: ${validation.controller}`);
    console.log(`[execute] Swap: ${intent.amountIn} ${intent.tokenIn} -> ${intent.tokenOut}`);

    const result = await executeIntent(intent, signature, paymentReference, cachedQuote);

    console.log(`[execute] Success. JobId: ${result.jobId}, TxHash: ${result.txHash}`);

    // Record execution event to JSON indexer
    recordEvent({
      vault: intent.vaultAddress.toLowerCase(),
      type: "ExecutionSucceeded",
      blockNumber: 0, // filled async below
      txHash: result.txHash,
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        jobId: result.jobId,
        controller: validation.controller,
        tokenIn: intent.tokenIn,
        tokenOut: intent.tokenOut,
        amountIn: intent.amountIn,
        amountOut: cachedQuote.expectedOut,
      },
    });

    res.json({
      status: "success",
      jobId: result.jobId,
      txHash: result.txHash,
    });
  } catch (err) {
    console.error("[execute] Error:", err);
    res.status(500).json({
      error: "Execution failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/receipts/:jobId", async (req: Request, res: Response) => {
  try {
    const registry = new ethers.Contract(config.registryAddress, ExecutionRegistryABI, getProvider());
    const receipt = await registry.getReceipt(req.params.jobId);

    if (!receipt || BigInt(receipt.timestamp) === 0n) {
      res.status(404).json({ error: "Receipt not found" });
      return;
    }

    res.json({
      jobId: receipt.jobId,
      vaultAddress: receipt.vault,
      controller: receipt.controller,
      operator: receipt.operator,
      adapter: receipt.adapter,
      paymentReference: receipt.paymentRef,
      tokenIn: receipt.tokenIn,
      tokenOut: receipt.tokenOut,
      amountIn: receipt.amountIn.toString(),
      amountOut: receipt.amountOut.toString(),
      timestamp: Number(receipt.timestamp),
      status: receipt.success ? "success" : "failed",
    });
  } catch (err) {
    console.error("[receipts] Error:", err);
    res.status(500).json({
      error: "Failed to fetch receipt",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/operator/track-record", async (_req: Request, res: Response) => {
  try {
    const operatorAddress = buildPaymentChallenge().paymentAddress;
    const registry = new ethers.Contract(config.registryAddress, ExecutionRegistryABI, getProvider());
    const successCount = await registry.getTrackRecord(operatorAddress);

    res.json({
      operator: operatorAddress,
      successCount: successCount.toString(),
    });
  } catch (err) {
    console.error("[track-record] Error:", err);
    res.status(500).json({
      error: "Failed to fetch operator track record",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
