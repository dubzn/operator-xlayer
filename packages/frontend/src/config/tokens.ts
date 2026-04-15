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

  // --- Celo top 10 tokens ---
  "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e": {
    symbol: "USDT",
    name: "Tether USD (Celo)",
    decimals: 6,
    icon: "/tokens/usdt.png",
  },
  "0xceba9300f2b948710d2653dd7b07f33a8b32118c": {
    symbol: "USDC",
    name: "USDC (Celo)",
    decimals: 6,
    icon: "/tokens/usdc.png",
  },
  "0xd07294e6e917e07dfdcee882dd1e2565085c2ae0": {
    symbol: "LINK",
    name: "ChainLink Token",
    decimals: 18,
    icon: "/tokens/link.png",
  },
  "0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff": {
    symbol: "XAUt",
    name: "Tether Gold",
    decimals: 6,
    icon: "/tokens/xaut.png",
  },
  "0xd15ec721c2a896512ad29c671997dd68f9593226": {
    symbol: "SUSHI",
    name: "Sushi",
    decimals: 18,
    icon: "/tokens/sushi.png",
  },
  "0x471ece3750da237f93b8e339c536989b8978a438": {
    symbol: "CELO",
    name: "Celo",
    decimals: 18,
    icon: "/tokens/celo.png",
  },
  "0xfecb3f7c54e2caae9dc6ac9060a822d47e053760": {
    symbol: "BRLA",
    name: "BRLA Digital",
    decimals: 18,
    icon: "/tokens/brla.png",
  },
  "0x765de816845861e75a25fca122bb6898b8b1282a": {
    symbol: "cUSD",
    name: "Celo Dollar",
    decimals: 18,
    icon: "/tokens/cusd.png",
  },
  "0xb9c8f0d3254007ee4b98970b94544e473cd610ec": {
    symbol: "MAI",
    name: "MAI (Mimatic)",
    decimals: 18,
    icon: "/tokens/mai.png",
  },
  "0x9995cc8f20db5896943afc8ee0ba463259c931ed": {
    symbol: "ETHIX",
    name: "Ethix",
    decimals: 18,
    icon: "/tokens/ethix.png",
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
