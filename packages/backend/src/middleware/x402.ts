import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";
import { config, getProvider } from "../config.js";
import { ERC20ABI } from "../abi.js";

/**
 * x402 middleware — Phase 1 simplified implementation.
 *
 * If request has no paymentReference → respond 402 with fee details.
 * If paymentReference present → verify the payment tx onchain.
 */
export async function x402Middleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const paymentReference = req.body.paymentReference;

  if (!paymentReference) {
    res.status(402).json({
      fee: config.operatorFee,
      token: config.feeToken,
      paymentAddress: new ethers.Wallet(config.operatorPrivateKey).address,
      message: "Payment required. Transfer the fee and re-submit with paymentReference (tx hash).",
    });
    return;
  }

  // Verify payment onchain
  try {
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(paymentReference);

    if (!receipt || receipt.status !== 1) {
      res.status(400).json({ error: "Payment transaction failed or not found" });
      return;
    }

    // Check for ERC20 Transfer event to operator
    const operatorAddress = new ethers.Wallet(config.operatorPrivateKey).address;
    const iface = new ethers.Interface(ERC20ABI);

    const transferFound = receipt.logs.some((log) => {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        return (
          parsed?.name === "Transfer" &&
          parsed.args.to.toLowerCase() === operatorAddress.toLowerCase() &&
          BigInt(parsed.args.value) >= BigInt(config.operatorFee)
        );
      } catch {
        return false;
      }
    });

    if (!transferFound) {
      res.status(402).json({
        error: "Payment not verified. Expected Transfer to operator address.",
        fee: config.operatorFee,
        token: config.feeToken,
        paymentAddress: operatorAddress,
      });
      return;
    }

    // Payment verified — continue
    next();
  } catch (err) {
    res.status(500).json({ error: "Failed to verify payment", details: String(err) });
  }
}
