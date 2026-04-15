export interface CachedQuote {
  adapterAddress: string;
  routerAddress: string;
  routeData: string;
  expectedOut: string;
  minAmountOut: string;
  expiresAt: number;
}

const quoteCache = new Map<string, CachedQuote>();

function cacheKey(vaultAddress: string, executionHash: string) {
  return `${vaultAddress.toLowerCase()}:${executionHash.toLowerCase()}`;
}

function prune(now = Math.floor(Date.now() / 1000)) {
  for (const [key, value] of quoteCache.entries()) {
    if (value.expiresAt <= now) {
      quoteCache.delete(key);
    }
  }
}

export function storeQuote(vaultAddress: string, executionHash: string, quote: CachedQuote) {
  prune();
  quoteCache.set(cacheKey(vaultAddress, executionHash), quote);
}

export function getQuote(vaultAddress: string, executionHash: string): CachedQuote | null {
  prune();
  return quoteCache.get(cacheKey(vaultAddress, executionHash)) ?? null;
}
