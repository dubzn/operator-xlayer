export interface CachedQuote {
  adapterAddress: string;
  routerAddress: string;
  routeData: string;
  expectedOut: string;
  minAmountOut: string;
  expiresAt: number;
}

const quoteCache = new Map<string, CachedQuote>();

function prune(now = Math.floor(Date.now() / 1000)) {
  for (const [key, value] of quoteCache.entries()) {
    if (value.expiresAt <= now) {
      quoteCache.delete(key);
    }
  }
}

export function storeQuote(executionHash: string, quote: CachedQuote) {
  prune();
  quoteCache.set(executionHash.toLowerCase(), quote);
}

export function getQuote(executionHash: string): CachedQuote | null {
  prune();
  return quoteCache.get(executionHash.toLowerCase()) ?? null;
}
