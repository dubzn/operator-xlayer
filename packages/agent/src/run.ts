import "dotenv/config";
import { ethers } from "ethers";
import { signIntent } from "@x402-operator/shared";
import type {
  ExecutionIntent,
  ExecuteRequest,
  ExecutionPreview,
  PaymentChallenge,
  PreviewRequest,
  RoutePreferences,
} from "@x402-operator/shared";

const OPERATOR_URL = process.env.OPERATOR_URL || "http://localhost:3000";
const CONTROLLER_PRIVATE_KEY = process.env.CONTROLLER_PRIVATE_KEY!;
const VAULT_ADDRESS = process.env.VAULT_ADDRESS!;
const SWAP_ADAPTER_ADDRESS = process.env.SWAP_ADAPTER_ADDRESS!;
const TOKEN_IN = process.env.TOKEN_IN!;
const TOKEN_OUT = process.env.TOKEN_OUT!;
const FEE_TOKEN = process.env.FEE_TOKEN!;
const RPC_URL = process.env.RPC_URL!;
const SWAP_AMOUNT = process.env.SWAP_AMOUNT || "1000000";
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || "30000");
const MAX_ROUNDS = parseInt(process.env.MAX_ROUNDS || "0");

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function formatAmount(raw: string, decimals = 6): string {
  return (Number(raw) / 10 ** decimals).toFixed(decimals > 6 ? 8 : 2);
}

function parseRoutePreferences(): RoutePreferences | undefined {
  const toList = (value: string | undefined) =>
    value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];

  const dexIds = toList(process.env.OKX_DEX_IDS);
  const excludeDexIds = toList(process.env.OKX_EXCLUDE_DEX_IDS);

  if (dexIds.length === 0 && excludeDexIds.length === 0) {
    return undefined;
  }

  return {
    ...(dexIds.length > 0 ? { dexIds } : {}),
    ...(excludeDexIds.length > 0 ? { excludeDexIds } : {}),
  };
}

async function apiCall<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${OPERATOR_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function executeSwapCycle(
  wallet: ethers.Wallet,
  nonce: number
): Promise<boolean> {
  const controller = wallet.address;

  const draftIntent: ExecutionIntent = {
    vaultAddress: VAULT_ADDRESS,
    controller,
    adapter: SWAP_ADAPTER_ADDRESS,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: SWAP_AMOUNT,
    quotedAmountOut: "0",
    minAmountOut: "0",
    nonce,
    deadline: Math.floor(Date.now() / 1000) + 300,
    executionHash: ethers.ZeroHash,
  };

  log(
    `Intent draft: swap ${formatAmount(SWAP_AMOUNT)} ${TOKEN_IN.slice(0, 8)}... -> ${TOKEN_OUT.slice(0, 8)}...`
  );

  const routePreferences = parseRoutePreferences();
  const previewBody: PreviewRequest = {
    intent: draftIntent,
    ...(routePreferences ? { routePreferences } : {}),
  };
  const preview = await apiCall<ExecutionPreview>("/preview", "POST", previewBody);

  if (preview.status !== 200) {
    log(`Preview failed (${preview.status}): ${JSON.stringify(preview.data)}`);
    return false;
  }

  const p = preview.data;
  const blockers = p.riskFlags.filter(
    (flag) => !flag.includes("route-not-ready") && !flag.includes("quote-missing")
  );

  if (blockers.length > 0) {
    log(`Preview blockers: ${blockers.join(", ")}`);
    for (const warning of p.warnings) log(`  Warning: ${warning}`);
    return false;
  }

  if (!p.quotedRoute.hasRouteData || p.quotedRoute.executionHash === ethers.ZeroHash) {
    log("No executable route data available — skipping");
    return false;
  }

  const intent: ExecutionIntent = {
    ...draftIntent,
    adapter: p.quotedRoute.adapterAddress,
    quotedAmountOut: p.quotedRoute.expectedOut,
    minAmountOut: p.quotedRoute.minAmountOut,
    executionHash: p.quotedRoute.executionHash,
  };

  log(
    `Preview OK — expected out: ${formatAmount(p.quotedRoute.expectedOut, 18)}, min out: ${formatAmount(p.quotedRoute.minAmountOut, 18)}, fee: ${formatAmount(p.estimatedFee.amount)}`
  );

  const signature = await signIntent(wallet, intent);
  log(`Signed intent (nonce=${nonce})`);

  const firstCall = await apiCall<PaymentChallenge>("/execute", "POST", {
    intent,
    signature,
  } as Partial<ExecuteRequest>);

  if (firstCall.status === 400) {
    log(`Validation rejected: ${JSON.stringify(firstCall.data)}`);
    return false;
  }

  if (firstCall.status !== 402) {
    log(`Unexpected status ${firstCall.status}: ${JSON.stringify(firstCall.data)}`);
    return false;
  }

  const challenge = firstCall.data;
  log(`Got 402 — fee: ${formatAmount(challenge.fee)} to ${challenge.paymentAddress.slice(0, 10)}...`);

  const feeContract = new ethers.Contract(
    challenge.token,
    ["function transfer(address to, uint256 amount) returns (bool)"],
    wallet
  );

  log("Paying operator fee...");
  const payTx = await feeContract.transfer(challenge.paymentAddress, challenge.fee);
  const payReceipt = await payTx.wait();
  const paymentReference = payReceipt.hash;
  log(`Fee paid: ${paymentReference}`);

  log("Executing swap...");
  const execCall = await apiCall<{ status: string; jobId: string; txHash: string }>(
    "/execute",
    "POST",
    { intent, signature, paymentReference } as ExecuteRequest
  );

  if (execCall.status !== 200) {
    log(`Execution failed (${execCall.status}): ${JSON.stringify(execCall.data)}`);
    return false;
  }

  log(`SUCCESS — jobId: ${execCall.data.jobId}`);
  log(`  txHash: ${execCall.data.txHash}`);

  return true;
}

async function main() {
  console.log("\n========================================");
  console.log("  X402 Operator — Trading Agent");
  console.log("========================================\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(CONTROLLER_PRIVATE_KEY, provider);

  log(`Controller: ${wallet.address}`);
  log(`Vault:      ${VAULT_ADDRESS}`);
  log(`Adapter:    ${SWAP_ADAPTER_ADDRESS}`);
  log(`Swap:       ${formatAmount(SWAP_AMOUNT)} per round`);
  log(`Interval:   ${INTERVAL_MS / 1000}s`);
  log(`Max rounds: ${MAX_ROUNDS || "unlimited"}\n`);

  const feeContract = new ethers.Contract(
    FEE_TOKEN,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );
  const balance = await feeContract.balanceOf(wallet.address);
  log(`Fee token balance: ${formatAmount(balance.toString())}\n`);

  let round = 0;
  let successes = 0;
  let failures = 0;

  const runRound = async () => {
    round++;
    const nonce = Date.now();
    log(`--- Round ${round} ---`);

    try {
      const ok = await executeSwapCycle(wallet, nonce);
      if (ok) successes++;
      else failures++;
    } catch (err) {
      failures++;
      log(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }

    log(`Score: ${successes} success / ${failures} failed\n`);
  };

  if (MAX_ROUNDS === 1) {
    await runRound();
    return;
  }

  await runRound();

  const interval = setInterval(async () => {
    if (MAX_ROUNDS > 0 && round >= MAX_ROUNDS) {
      log("Max rounds reached. Stopping.");
      clearInterval(interval);
      return;
    }
    await runRound();
  }, INTERVAL_MS);

  process.on("SIGINT", () => {
    log("\nShutting down...");
    clearInterval(interval);
    log(`Final score: ${successes} success / ${failures} failed in ${round} rounds`);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
