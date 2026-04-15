import { ethers } from "ethers";

export interface DemoToken {
  address: string;
  symbol: string;
  decimals: number;
  aliases: string[];
}

export interface ResolvedDemoToken {
  address: string;
  symbol: string;
  decimals: number;
}

const DEMO_TOKENS: DemoToken[] = [
  {
    address: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
    symbol: "USDT",
    decimals: 6,
    aliases: ["TETHER"],
  },
  {
    address: "0x74b7F16337b8972027F6196A17a631aC6dE26d22",
    symbol: "USDC",
    decimals: 6,
    aliases: ["USDCOIN"],
  },
];

const tokenByAlias = new Map<string, DemoToken>();
const tokenByAddress = new Map<string, DemoToken>();

for (const token of DEMO_TOKENS) {
  tokenByAddress.set(token.address.toLowerCase(), token);
  tokenByAlias.set(token.symbol.toUpperCase(), token);
  for (const alias of token.aliases) {
    tokenByAlias.set(alias.toUpperCase(), token);
  }
}

export function resolveDemoToken(input: string, fallbackDecimals = 18): ResolvedDemoToken {
  const value = input.trim();

  if (ethers.isAddress(value as string)) {
    const checksummed = ethers.getAddress(value);
    const known = tokenByAddress.get(checksummed.toLowerCase());
    if (known) {
      return {
        address: known.address,
        symbol: known.symbol,
        decimals: known.decimals,
      };
    }

    return {
      address: checksummed,
      symbol: `${checksummed.slice(0, 6)}...${checksummed.slice(-4)}`,
      decimals: fallbackDecimals,
    };
  }

  const symbolKey = input.trim().toUpperCase();
  const known = tokenByAlias.get(symbolKey);
  if (!known) {
    throw new Error(`Unknown token "${input}". Use a supported symbol like USDT/USDC or pass a token address.`);
  }

  return {
    address: known.address,
    symbol: known.symbol,
    decimals: known.decimals,
  };
}
