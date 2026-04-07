import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import type { ExecuteRequest, ExecutionPreview, PreviewRequest } from "@x402-operator/shared";
import { ExecutionRegistryABI } from "../abi.js";
import { config, getProvider } from "../config.js";
import { buildPaymentChallenge, isZeroAddress, verifyPayment } from "../middleware/x402.js";
import { consumePaymentReference } from "../services/paymentLedger.js";
import {
  buildPolicyCheckSummary,
  readIntentPolicySnapshot,
  validateIntent,
} from "../services/intentValidator.js";
import { executeIntent } from "../services/onchainExecutor.js";
import { getSwapQuote } from "../services/onchainos.js";

const router = Router();

router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { intent } = req.body as PreviewRequest;

    if (!intent) {
      res.status(400).json({ error: "Missing intent" });
      return;
    }

    if (intent.vaultAddress.toLowerCase() !== config.vaultAddress.toLowerCase()) {
      res.status(400).json({ error: "Vault address mismatch" });
      return;
    }

    const snapshot = await readIntentPolicySnapshot(intent);
    const summary = buildPolicyCheckSummary(intent, snapshot);
    const quote = await getSwapQuote(
      intent.tokenIn,
      intent.tokenOut,
      intent.amount,
      config.vaultAddress
    );

    const riskFlags: string[] = [];
    const warnings: string[] = [];

    if (!summary.controllerAuthorized) {
      riskFlags.push("controller-not-authorized");
      warnings.push("The controller is not authorized on the vault right now.");
    }

    if (!summary.nonceAvailable) {
      riskFlags.push("nonce-already-used");
      warnings.push("This nonce has already been consumed and cannot be replayed.");
    }

    if (snapshot.blockTimestamp > intent.deadline) {
      riskFlags.push("intent-already-expired");
      warnings.push("The provided deadline is already in the past.");
    }

    if (!summary.tokenInMatchesBaseToken) {
      riskFlags.push("token-in-must-match-base-token");
      warnings.push("MVP swaps must start from the vault baseToken.");
    }

    if (!summary.tokenOutAllowed) {
      riskFlags.push("token-out-not-allowed");
      warnings.push("The selected output token is not allowlisted on the vault.");
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

    if (quote.routeData === "0x") {
      riskFlags.push("route-not-ready");
      warnings.push("Route data is still stubbed, so this preview is informational only.");
    }

    if (quote.expectedOut === "0") {
      riskFlags.push("quote-missing");
      warnings.push("No executable quote is available yet from the trade integration.");
    }

    const preview: ExecutionPreview = {
      jobClass: "single-swap",
      vaultAddress: intent.vaultAddress,
      estimatedFee: {
        amount: config.operatorFee,
        token: config.feeToken,
      },
      quotedRoute: {
        routerAddress: isZeroAddress(quote.routerAddress) ? snapshot.trustedRouter : quote.routerAddress,
        hasRouteData: quote.routeData !== "0x",
        expectedOut: quote.expectedOut,
      },
      riskFlags,
      warnings,
      policyCheckSummary: summary,
      expiresAt: Math.min(intent.deadline, snapshot.blockTimestamp + 60),
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

    // 1. Validate intent offchain (gas-saving filter)
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
    console.log(`[execute] Swap: ${intent.amount} ${intent.tokenIn} → ${intent.tokenOut}`);

    // 2. Execute through vault
    const result = await executeIntent(intent, signature, paymentReference!);

    console.log(`[execute] Success. JobId: ${result.jobId}, TxHash: ${result.txHash}`);

    // 3. Return result
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
