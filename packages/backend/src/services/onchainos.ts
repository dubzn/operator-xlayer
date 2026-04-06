/**
 * OnchainOS Trade API client — Phase 1 stub.
 *
 * In Phase 1 this builds routeData for a direct DEX router call.
 * When OnchainOS Trade API is available, swap the implementation here.
 */

export interface TradeQuote {
  routeData: string;       // encoded calldata for the DEX router
  expectedOut: string;     // expected output amount
  routerAddress: string;   // target router (must match vault's trustedRouter)
}

export async function getSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  recipient: string
): Promise<TradeQuote> {
  // TODO: Replace with OnchainOS Trade API call
  // For now, this is a placeholder that returns empty route data.
  // In integration testing, we'll use a real DEX or mock.

  console.log("[onchainos] getSwapQuote called — using stub");
  console.log(`  tokenIn: ${tokenIn}`);
  console.log(`  tokenOut: ${tokenOut}`);
  console.log(`  amountIn: ${amountIn}`);

  // This stub will be replaced with actual OnchainOS Trade API:
  // const response = await fetch("https://onchainos.okx.com/trade/swap", {
  //   method: "POST",
  //   headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
  //   body: JSON.stringify({ chainId: 196, tokenIn, tokenOut, amount: amountIn, recipient })
  // });
  // const data = await response.json();
  // return { routeData: data.calldata, expectedOut: data.expectedOutput, routerAddress: data.router };

  return {
    routeData: "0x",
    expectedOut: "0",
    routerAddress: "0x0000000000000000000000000000000000000000",
  };
}
