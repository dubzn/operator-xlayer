/**
 * OnchainOS Trade API client.
 *
 * In testnet mode (USE_MOCK_ROUTER=true), builds routeData for MockRouter.
 * When OnchainOS Trade API is available, swap the implementation here.
 */

import { ethers } from "ethers";

export interface TradeQuote {
  routeData: string;       // encoded calldata for the DEX router
  expectedOut: string;     // expected output amount
  routerAddress: string;   // target router (must match vault's trustedRouter)
}

const MOCK_ROUTER_ABI = [
  "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)",
];

/**
 * For testnet with MockRouter: builds calldata that swaps tokenIn for tokenOut
 * at a ~1:1 rate (stablecoin-to-stablecoin).
 */
function getMockRouteData(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): TradeQuote {
  // ~1:1 for stablecoin pairs, minus a small "spread" for realism
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
    routerAddress: "", // will be checked against vault.trustedRouter
  };
}

export async function getSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  recipient: string
): Promise<TradeQuote> {
  const useMock = process.env.USE_MOCK_ROUTER === "true";

  if (useMock) {
    console.log("[onchainos] Using MockRouter for testnet swap");
    return getMockRouteData(tokenIn, tokenOut, amountIn);
  }

  // TODO: Replace with OnchainOS Trade API call
  // const response = await fetch("https://onchainos.okx.com/trade/swap", {
  //   method: "POST",
  //   headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
  //   body: JSON.stringify({ chainId, tokenIn, tokenOut, amount: amountIn, recipient })
  // });
  // const data = await response.json();
  // return { routeData: data.calldata, expectedOut: data.expectedOutput, routerAddress: data.router };

  return {
    routeData: "0x",
    expectedOut: "0",
    routerAddress: "0x0000000000000000000000000000000000000000",
  };
}
