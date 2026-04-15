import "dotenv/config";
import { ethers } from "ethers";

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function envList(key: string): string[] {
  const val = process.env[key];
  if (!val) return [];
  return val
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  port: parseInt(process.env.PORT || "3000"),
  chainId: parseInt(process.env.CHAIN_ID || "196"),
  rpcUrl: env("RPC_URL"),
  operatorPrivateKey: env("OPERATOR_PRIVATE_KEY"),
  registryAddress: env("REGISTRY_ADDRESS"),
  swapAdapterAddress: env("SWAP_ADAPTER_ADDRESS"),
  operatorFee: env("OPERATOR_FEE"), // in token smallest unit
  feeToken: env("FEE_TOKEN"), // token address for fee payment
  defaultWatchVaults: envList("DEFAULT_WATCH_VAULTS"),
} as const;

export function getProvider() {
  return new ethers.JsonRpcProvider(config.rpcUrl);
}

export function getOperatorAddress() {
  return new ethers.Wallet(config.operatorPrivateKey).address;
}

export function getOperatorWallet() {
  return new ethers.Wallet(config.operatorPrivateKey, getProvider());
}
