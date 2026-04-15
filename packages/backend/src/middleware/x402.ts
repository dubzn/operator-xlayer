import { ethers } from "ethers";
import type { PaymentChallenge } from "@x402-operator/shared";
import { config, getOperatorAddress, getProvider } from "../config.js";
import { ERC20ABI } from "../abi.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function buildPaymentChallenge(): PaymentChallenge {
  return {
    fee: config.operatorFee,
    token: config.feeToken,
    paymentAddress: getOperatorAddress(),
    message: "Payment required. Transfer the fee and re-submit with paymentReference (tx hash).",
  };
}

/**
 * Verifies that a payment tx contains an ERC20 Transfer from the expected caller
 * to the operator for at least the configured fee token amount.
 */
export async function verifyPayment(
  paymentReference: string,
  expectedPayer: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(paymentReference);

    if (!receipt || receipt.status !== 1) {
      return { valid: false, error: "Payment transaction failed or not found" };
    }

    const operatorAddress = getOperatorAddress().toLowerCase();
    const expectedPayerLower = expectedPayer.toLowerCase();
    const feeTokenLower = config.feeToken.toLowerCase();
    const iface = new ethers.Interface(ERC20ABI);

    const transferFound = receipt.logs.some((log) => {
      if (log.address.toLowerCase() !== feeTokenLower) {
        return false;
      }

      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name !== "Transfer") {
          return false;
        }

        const from = String(parsed.args.from).toLowerCase();
        const to = String(parsed.args.to).toLowerCase();
        const value = BigInt(parsed.args.value);

        return (
          from === expectedPayerLower &&
          to === operatorAddress &&
          value >= BigInt(config.operatorFee)
        );
      } catch {
        return false;
      }
    });

    if (!transferFound) {
      return {
        valid: false,
        error: "Payment not verified. Expected configured fee token transfer from controller to operator.",
      };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Failed to verify payment: ${String(err)}` };
  }
}

export function isZeroAddress(address: string): boolean {
  return !address || address.toLowerCase() === ZERO_ADDRESS;
}
