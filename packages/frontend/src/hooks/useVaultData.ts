import { useState, useEffect, useCallback } from "react";
import type { PublicClient, Address } from "viem";
import {
  OPERATOR_VAULT_ABI,
  ERC20_ABI,
  ADDRESSES,
} from "../config/contracts";

export interface VaultData {
  owner: Address;
  baseToken: Address;
  operator: Address;
  paused: boolean;
  maxAmountPerTrade: bigint;
  maxDailyVolume: bigint;
  maxSlippageBps: bigint;
  cooldownSeconds: bigint;
  dailyVolumeUsed: bigint;
  lastExecution: bigint;
  balanceUsdt: bigint;
  balanceUsdc: bigint;
}

export function useVaultData(
  publicClient: PublicClient,
  vaultAddress: Address | null
) {
  const [data, setData] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!vaultAddress) return;
    setLoading(true);
    try {
      const read = (fname: string) =>
        publicClient.readContract({
          address: vaultAddress,
          abi: OPERATOR_VAULT_ABI,
          functionName: fname as never,
        });

      const readBalance = (token: Address) =>
        publicClient.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [vaultAddress],
        });

      const [
        owner,
        baseToken,
        operator,
        paused,
        maxAmountPerTrade,
        maxDailyVolume,
        maxSlippageBps,
        cooldownSeconds,
        dailyVolumeUsed,
        lastExecution,
        balanceUsdt,
        balanceUsdc,
      ] = await Promise.all([
        read("owner"),
        read("baseToken"),
        read("authorizedOperator"),
        read("paused"),
        read("maxAmountPerTrade"),
        read("maxDailyVolume"),
        read("maxSlippageBps"),
        read("cooldownSeconds"),
        read("dailyVolumeUsed"),
        read("lastExecution"),
        readBalance(ADDRESSES.usdt),
        readBalance(ADDRESSES.usdc),
      ]);

      setData({
        owner: owner as Address,
        baseToken: baseToken as Address,
        operator: operator as Address,
        paused: paused as boolean,
        maxAmountPerTrade: maxAmountPerTrade as bigint,
        maxDailyVolume: maxDailyVolume as bigint,
        maxSlippageBps: maxSlippageBps as bigint,
        cooldownSeconds: cooldownSeconds as bigint,
        dailyVolumeUsed: dailyVolumeUsed as bigint,
        lastExecution: lastExecution as bigint,
        balanceUsdt: balanceUsdt as bigint,
        balanceUsdc: balanceUsdc as bigint,
      });
    } catch (err) {
      console.error("Failed to read vault:", err);
    } finally {
      setLoading(false);
    }
  }, [publicClient, vaultAddress]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { data, loading, refresh };
}
