/**
 * OKX DEX Aggregator API client.
 *
 * Production mode: calls the OKX DEX API for real swap quotes and route data.
 * Testnet mode (USE_MOCK_ROUTER=true): builds routeData for MockRouter.
 */

import { ethers } from "ethers";
import * as crypto from "node:crypto";

export interface TradeQuote {
  routeData: string;       // encoded calldata for the DEX router
  expectedOut: string;     // expected output amount
  routerAddress: string;   // target router (must match vault's trustedRouter)
}

// --- OKX DEX API auth ---

const OKX_API_KEY = process.env.OKX_API_KEY || "";
const OKX_SECRET_KEY = process.env.OKX_SECRET_KEY || "";
const OKX_PASSPHRASE = process.env.OKX_PASSPHRASE || "";
const OKX_PROJECT_ID = process.env.OKX_PROJECT_ID || "";
const OKX_BASE_URL = "https://web3.okx.com";

function buildOkxHeaders(method: string, path: string, queryString: string): Record<string, string> {
  const timestamp = new Date().toISOString();
  const stringToSign = timestamp + method.toUpperCase() + path + (queryString ? "?" + queryString : "");
  const sign = crypto
    .createHmac("sha256", OKX_SECRET_KEY)
    .update(stringToSign)
    .digest("base64");

  return {
    "OK-ACCESS-KEY": OKX_API_KEY,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": OKX_PASSPHRASE,
    "OK-ACCESS-PROJECT": OKX_PROJECT_ID,
    "Content-Type": "application/json",
  };
}

// --- OKX DEX API calls ---

interface OkxSwapResponse {
  code: string;
  msg: string;
  data: Array<{
    routerResult: {
      toTokenAmount: string;
      fromTokenAmount: string;
      estimateGasFee: string;
    };
    tx: {
      from: string;
      to: string;
      value: string;
      data: string;
      gas: string;
      minReceiveAmount: string;
    };
  }>;
}

async function getOkxSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  vaultAddress: string
): Promise<TradeQuote> {
  const chainIndex = process.env.CHAIN_ID || "196";
  const slippage = process.env.DEX_SLIPPAGE || "0.01"; // 1%

  const params = new URLSearchParams({
    chainIndex,
    fromTokenAddress: tokenIn,
    toTokenAddress: tokenOut,
    amount: amountIn,
    slippagePercent: slippage,
    userWalletAddress: vaultAddress,
  });

  const path = "/api/v6/dex/aggregator/swap";
  const queryString = params.toString();
  const headers = buildOkxHeaders("GET", path, queryString);

  const url = `${OKX_BASE_URL}${path}?${queryString}`;
  console.log(`[onchainos] Fetching OKX DEX quote: ${amountIn} ${tokenIn.slice(0, 8)}... → ${tokenOut.slice(0, 8)}...`);

  const res = await fetch(url, { method: "GET", headers });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[onchainos] OKX API error ${res.status}: ${body}`);
    throw new Error(`OKX DEX API returned ${res.status}`);
  }

  const json: OkxSwapResponse = await res.json();

  if (json.code !== "0" || !json.data || json.data.length === 0) {
    console.error(`[onchainos] OKX API response error:`, json.msg);
    throw new Error(`OKX DEX API error: ${json.msg || "no data"}`);
  }

  const result = json.data[0];

  console.log(`[onchainos] Quote: ${amountIn} → ${result.routerResult.toTokenAmount} (router: ${result.tx.to})`);

  return {
    routeData: result.tx.data,
    expectedOut: result.routerResult.toTokenAmount,
    routerAddress: result.tx.to,
  };
}

// --- Mock Router (testnet fallback) ---

const MOCK_ROUTER_ABI = [
  "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)",
];

function getMockRouteData(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): TradeQuote {
  const amountInBn = BigInt(amountIn);
  const expectedOut = amountInBn * 99n / 100n; // 1% spread

  const iface = new ethers.Interface(MOCK_ROUTER_ABI);
  const routeData = iface.encodeFunctionData("swap", [
    tokenIn,
    tokenOut,
    amountInBn,
    expectedOut,
  ]);

  return {
    routeData,
    expectedOut: expectedOut.toString(),
    routerAddress: "",
  };
}

// --- Public API ---

export async function getSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  vaultAddress: string
): Promise<TradeQuote> {
  const useMock = process.env.USE_MOCK_ROUTER === "true";

  if (useMock) {
    console.log("[onchainos] Using MockRouter for testnet swap");
    return getMockRouteData(tokenIn, tokenOut, amountIn);
  }

  // Production: use OKX DEX API
  if (!OKX_API_KEY) {
    throw new Error("OKX_API_KEY not configured. Set USE_MOCK_ROUTER=true for testnet or configure OKX API credentials.");
  }

  return getOkxSwapQuote(tokenIn, tokenOut, amountIn, vaultAddress);
}
