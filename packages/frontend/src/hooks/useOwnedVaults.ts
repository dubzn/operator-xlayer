import { useCallback, useEffect, useRef, useState } from "react";
import type { Address, PublicClient } from "viem";
import { ADDRESSES, VAULT_FACTORY_ABI } from "../config/contracts";

export function useOwnedVaults(publicClient: PublicClient, owner: Address | null) {
  const [vaults, setVaults] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);

  const refresh = useCallback(async () => {
    if (!owner) {
      setVaults([]);
      setLoading(false);
      setError(null);
      hasData.current = false;
      return;
    }

    // Only show loading spinner on the initial fetch — subsequent polls run silently
    if (!hasData.current) setLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: ADDRESSES.factory,
        abi: VAULT_FACTORY_ABI,
        functionName: "getVaultsByOwner",
        args: [owner],
      });

      setVaults(result as Address[]);
      hasData.current = true;
    } catch (err) {
      console.error("Failed to fetch owned vaults:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch owned vaults");
      setVaults([]);
    } finally {
      setLoading(false);
    }
  }, [owner, publicClient]);

  useEffect(() => {
    hasData.current = false;
    refresh();

    if (!owner) return undefined;

    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [owner, refresh]);

  return { vaults, loading, error, refresh };
}
