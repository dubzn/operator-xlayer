import "dotenv/config";
import { ethers } from "ethers";

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT || "3000"),
  chainId: parseInt(process.env.CHAIN_ID || "196"),
  rpcUrl: env("RPC_URL"),
  operatorPrivateKey: env("OPERATOR_PRIVATE_KEY"),
  vaultAddress: env("VAULT_ADDRESS"),
  registryAddress: env("REGISTRY_ADDRESS"),
  operatorFee: env("OPERATOR_FEE"), // in token smallest unit
  feeToken: env("FEE_TOKEN"), // token address for fee payment
} as const;

export function getProvider() {
  return new ethers.JsonRpcProvider(config.rpcUrl);
}

export function getOperatorWallet() {
  return new ethers.Wallet(config.operatorPrivateKey, getProvider());
}
