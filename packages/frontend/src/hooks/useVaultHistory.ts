import { useState, useEffect, useCallback } from "react";
import type { Address } from "viem";

const BACKEND_URL = "http://localhost:3000";

export interface IndexedEvent {
  vault: string;
  type: string;
  blockNumber: number;
  txHash: string;
  timestamp: number;
  data: Record<string, string>;
}

export function useVaultHistory(vaultAddress: Address | null) {
  const [events, setEvents] = useState<IndexedEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!vaultAddress) return;
    setLoading(true);
    try {
      // Register vault for watching (idempotent)
      await fetch(`${BACKEND_URL}/indexer/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vault: vaultAddress }),
      });

      // Fetch events
      const res = await fetch(`${BACKEND_URL}/events/${vaultAddress}`);
      if (res.ok) {
        const data: IndexedEvent[] = await res.json();
        // Sort newest first
        data.sort((a, b) => b.blockNumber - a.blockNumber);
        setEvents(data);
      }
    } catch (err) {
      console.error("Failed to fetch vault history:", err);
    } finally {
      setLoading(false);
    }
  }, [vaultAddress]);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 10_000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  return { events, loading, refresh: fetchHistory };
}
