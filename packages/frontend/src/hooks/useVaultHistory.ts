import { useState, useEffect, useCallback } from "react";
import type { Address } from "viem";
import { isDemoMode, getDemoEvents, subscribeDemoUpdates } from "../demo/demoData";

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
  const demo = isDemoMode();
  const [events, setEvents] = useState<IndexedEvent[]>(
    demo && vaultAddress ? getDemoEvents(vaultAddress) : []
  );
  const [loading, setLoading] = useState(false);

  // In demo mode, subscribe to live updates from Ctrl+K
  useEffect(() => {
    if (!demo || !vaultAddress) return undefined;

    setEvents(getDemoEvents(vaultAddress));

    const unsub = subscribeDemoUpdates(() => {
      setEvents(getDemoEvents(vaultAddress));
    });
    return unsub;
  }, [demo, vaultAddress]);

  const fetchHistory = useCallback(async () => {
    if (demo) {
      if (vaultAddress) setEvents(getDemoEvents(vaultAddress));
      return;
    }

    if (!vaultAddress) {
      setEvents([]);
      setLoading(false);
      return;
    }

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
        // Sort newest first, prioritizing actual event time over block number
        data.sort((a, b) => b.timestamp - a.timestamp || b.blockNumber - a.blockNumber);
        setEvents(data);
      }
    } catch (err) {
      console.error("Failed to fetch vault history:", err);
    } finally {
      setLoading(false);
    }
  }, [demo, vaultAddress]);

  useEffect(() => {
    if (demo) return undefined;

    if (!vaultAddress) {
      setEvents([]);
      return undefined;
    }

    fetchHistory();
    const interval = setInterval(fetchHistory, 10_000);
    return () => clearInterval(interval);
  }, [demo, fetchHistory, vaultAddress]);

  return { events, loading, refresh: fetchHistory };
}
