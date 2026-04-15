export interface TokenMeta {
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
}

/**
 * Top tokens on Celo mainnet (from Blockscout) plus X Layer stablecoins.
 * Keys are lowercased addresses for fast lookup.
 */
const TOKEN_REGISTRY: Record<string, TokenMeta> = {
  // --- X Layer tokens (used by vaults) ---
  "0x1e4a5963abfd975d8c9021ce480b42188849d41d": {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    icon: "/tokens/usdt.png",
  },
  "0x74b7f16337b8972027f6196a17a631ac6de26d22": {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    icon: "/tokens/usdc.png",
  },

  // --- X Layer top tokens ---
  "0x779ded0c9e1022225f8e0630b35a9b54be713736": {
    symbol: "USDT0",
    name: "USD₮0",
    decimals: 6,
    icon: "/tokens/usdt.png",
  },
  "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8": {
    symbol: "USDG",
    name: "Global Dollar",
    decimals: 6,
    icon: "/tokens/usdg.png",
  },
  "0xe538905cf8410324e03a5a23c1c177a474d59b2b": {
    symbol: "WOKB",
    name: "Wrapped OKB",
    decimals: 18,
    icon: "/tokens/wokb.png",
  },
  "0xb7c00000bcdeef966b20b3d884b98e64d2b06b4f": {
    symbol: "XBTC",
    name: "OKX Wrapped BTC",
    decimals: 18,
    icon: "/tokens/xbtc.png",
  },
  "0xe7b000003a45145decf8a28fc755ad5ec5ea025a": {
    symbol: "XETH",
    name: "OKX Wrapped ETH",
    decimals: 18,
    icon: "/tokens/xeth.png",
  },
  "0x505000008de8748dbd4422ff4687a4fc9beba15b": {
    symbol: "XSOL",
    name: "OKX Wrapped SOL",
    decimals: 18,
    icon: "/tokens/xsol.png",
  },
};

export function getTokenMeta(address: string): TokenMeta | undefined {
  return TOKEN_REGISTRY[address.toLowerCase()];
}

export function tokenLabel(address: string): string {
  const meta = getTokenMeta(address);
  return meta ? meta.symbol : `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function tokenIcon(address: string): string | undefined {
  return getTokenMeta(address)?.icon;
}

export function tokenName(address: string): string {
  const meta = getTokenMeta(address);
  return meta ? meta.name : `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export { TOKEN_REGISTRY };
