import { ethers } from "ethers";
import type { ExecutionIntent } from "./types.js";

export const EIP712_DOMAIN = {
  name: "X402Operator",
  version: "1",
  chainId: parseInt(process.env.CHAIN_ID || "196"),
};

export const EXECUTION_INTENT_TYPES = {
  ExecutionIntent: [
    { name: "vaultAddress", type: "address" },
    { name: "controller", type: "address" },
    { name: "tokenIn", type: "address" },
    { name: "tokenOut", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "maxSlippageBps", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

export function getDomain(vaultAddress: string) {
  return {
    ...EIP712_DOMAIN,
    verifyingContract: vaultAddress,
  };
}

export async function signIntent(
  signer: ethers.Signer,
  intent: ExecutionIntent
): Promise<string> {
  const domain = getDomain(intent.vaultAddress);
  const typedSigner = signer as ethers.Signer & {
    signTypedData: typeof ethers.Wallet.prototype.signTypedData;
  };
  return typedSigner.signTypedData(domain, EXECUTION_INTENT_TYPES, intent);
}

export function recoverIntentSigner(
  intent: ExecutionIntent,
  signature: string
): string {
  const domain = getDomain(intent.vaultAddress);
  return ethers.verifyTypedData(domain, EXECUTION_INTENT_TYPES, intent, signature);
}

export function hashIntent(intent: ExecutionIntent): string {
  const domain = getDomain(intent.vaultAddress);
  return ethers.TypedDataEncoder.hash(domain, EXECUTION_INTENT_TYPES, intent);
}

export function computeJobId(intentHash: string, paymentRef: string): string {
  return ethers.solidityPackedKeccak256(
    ["bytes32", "bytes32"],
    [intentHash, paymentRef]
  );
}
