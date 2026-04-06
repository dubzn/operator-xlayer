import { Router, Request, Response } from "express";
import type { ExecuteRequest } from "@x402-operator/shared";
import { x402Middleware } from "../middleware/x402.js";
import { validateIntent } from "../services/intentValidator.js";
import { executeIntent } from "../services/onchainExecutor.js";

const router = Router();

router.post("/execute", x402Middleware, async (req: Request, res: Response) => {
  try {
    const { intent, signature, paymentReference } = req.body as ExecuteRequest;

    // 1. Validate intent offchain (gas-saving filter)
    const validation = await validateIntent(intent, signature);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
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

export default router;
