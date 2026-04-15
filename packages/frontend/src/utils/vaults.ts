import type { Address } from "viem";
import type { VaultData } from "../hooks/useVaultData";
import { ADDRESSES } from "../config/contracts";

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
}

const TOKEN_METADATA: Record<string, Omit<TokenMetadata, "address">> = {
  [ADDRESSES.usdt.toLowerCase()]: {
    symbol: "USDT",
    name: "Tether USD",
  },
  [ADDRESSES.usdc.toLowerCase()]: {
    symbol: "USDC",
    name: "USD Coin",
  },
};

// Symbol → brand color for known tokens (used for styled badges)
const TOKEN_COLORS: Record<string, string> = {
  USDT: "#26A17B",
  USDC: "#2775CA",
};

export function getTokenColor(symbol: string): string {
  return TOKEN_COLORS[symbol.toUpperCase()] ?? "#8686AC";
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function getTokenMetadata(addr: string): TokenMetadata {
  const lower = addr.toLowerCase();
  const known = TOKEN_METADATA[lower];
  if (known) {
    return {
      address: addr,
      ...known,
    };
  }

  return {
    address: addr,
    symbol: shortAddr(addr),
    name: "Tracked token",
  };
}

export function tokenLabel(addr: string): string {
  return getTokenMetadata(addr).symbol;
}

export function tokenTooltip(addr: string): string {
  const token = getTokenMetadata(addr);
  if (token.name === "Tracked token") {
    return token.address;
  }

  return `${token.name} (${token.symbol})`;
}

export function deriveVaultName(baseToken: Address | string): string {
  return `${tokenLabel(baseToken)} Reserve Vault`;
}

export function deriveNetValueUsd(data: Pick<VaultData, "balanceUsdt" | "balanceUsdc">): number {
  return Number(data.balanceUsdt + data.balanceUsdc) / 1e6;
}

export function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatLastExecution(lastExecution: bigint): string {
  if (lastExecution <= 0n) return "Never";
  return new Date(Number(lastExecution) * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function collectVaultTokens(
  data: Pick<VaultData, "baseToken" | "balanceUsdt" | "balanceUsdc">
): TokenMetadata[] {
  const tokens = new Map<string, TokenMetadata>();

  const addToken = (address: string) => {
    tokens.set(address.toLowerCase(), getTokenMetadata(address));
  };

  addToken(data.baseToken);

  if (data.balanceUsdt > 0n) {
    addToken(ADDRESSES.usdt);
  }

  if (data.balanceUsdc > 0n) {
    addToken(ADDRESSES.usdc);
  }

  return Array.from(tokens.values());
}

export function deriveVaultNetworkDelta24h(vault: string) {
  const random = createSeededRandom(hashString(`${vault}-24h-network-delta`));
  const networkChange = random() * 3.8 - 1.1;
  const vaultChange = networkChange + (random() * 7.2 - 2.4);
  const relative = vaultChange - networkChange;

  return {
    vaultChange,
    networkChange,
    relative,
  };
}
