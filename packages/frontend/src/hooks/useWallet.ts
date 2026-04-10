import { useState, useCallback } from "react";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  type WalletClient,
  type PublicClient,
  type Address,
} from "viem";
import { CHAIN_ID, RPC_URL } from "../config/contracts";

const xlayer = {
  id: CHAIN_ID,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: "OKX Explorer",
      url: "https://www.okx.com/explorer/xlayer",
    },
  },
} as const;

function parseAccounts(value: unknown): Address[] {
  if (!Array.isArray(value)) {
    throw new Error("Wallet did not return an account list");
  }

  const accounts = value.filter((entry): entry is Address => typeof entry === "string") as Address[];
  if (accounts.length === 0) {
    throw new Error("No wallet accounts available");
  }

  return accounts;
}

export function useWallet() {
  const [address, setAddress] = useState<Address | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [publicClient] = useState<PublicClient>(
    createPublicClient({ chain: xlayer, transport: http(RPC_URL) })
  );
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not found");
      }

      const accountsResponse = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const accounts = parseAccounts(accountsResponse);

      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
        });
      } catch (switchError: unknown) {
        if ((switchError as { code?: number }).code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${CHAIN_ID.toString(16)}`,
                chainName: "X Layer",
                nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
                rpcUrls: [RPC_URL],
                blockExplorerUrls: ["https://www.okx.com/explorer/xlayer"],
              },
            ],
          });
        }
      }

      const client = createWalletClient({
        chain: xlayer,
        transport: custom(window.ethereum),
        account: accounts[0],
      });

      setAddress(accounts[0]);
      setWalletClient(client);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setWalletClient(null);
  }, []);

  return { address, walletClient, publicClient, connect, disconnect, connecting, error };
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}
