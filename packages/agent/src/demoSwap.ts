import "dotenv/config";
import { ethers } from "ethers";
import { signIntent } from "@x402-operator/shared";
import type {
  ExecuteRequest,
  ExecutionIntent,
  ExecutionPreview,
  PaymentChallenge,
  PreviewRequest,
} from "@x402-operator/shared";
import { resolveDemoToken, type ResolvedDemoToken } from "./demoTokens.js";

const OPERATOR_URL = process.env.OPERATOR_URL || "http://localhost:3000";
const CONTROLLER_PRIVATE_KEY = process.env.CONTROLLER_PRIVATE_KEY!;
const SWAP_ADAPTER_ADDRESS = process.env.SWAP_ADAPTER_ADDRESS!;
const RPC_URL = process.env.RPC_URL!;
const AUTO_WATCH_VAULTS = (process.env.AUTO_WATCH_VAULTS || "true").toLowerCase() !== "false";

interface HealthResponse {
  status: string;
  mode?: string;
  registry?: string;
  adapter?: string;
  watchedVaults?: number;
}

interface WatchResponse {
  ok: boolean;
  watching: string[] | string;
}

interface CliOptions {
  vault: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  previewOnly: boolean;
  executeIfReady: boolean;
  json: boolean;
  watchVault: boolean;
  deadlineSeconds: number;
  tokenInDecimals?: number;
  tokenOutDecimals?: number;
}

interface DemoResult {
  status: "preview-not-ready" | "preview-ready" | "executed";
  vaultAddress: string;
  tokenIn: ResolvedDemoToken;
  tokenOut: ResolvedDemoToken;
  humanAmountIn: string;
  amountIn: string;
  backend: {
    url: string;
    mode?: string;
    watchedVaults?: number;
  };
  preview: {
    ready: boolean;
    riskFlags: string[];
    warnings: string[];
    expectedOut: string;
    expectedOutFormatted: string;
    minAmountOut: string;
    minAmountOutFormatted: string;
    feeAmount: string;
    feeToken: string;
    executionHash: string;
    expiresAt: number;
    policyCheckSummary: ExecutionPreview["policyCheckSummary"];
  };
  execution?: {
    jobId: string;
    txHash: string;
    paymentReference: string;
  };
}

function parseArgs(argv: string[]): CliOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags.add(current);
      continue;
    }

    values.set(current, next);
    i += 1;
  }

  const vault = values.get("--vault");
  const tokenIn = values.get("--from") ?? values.get("--token-in");
  const tokenOut = values.get("--to") ?? values.get("--token-out");
  const amount = values.get("--amount");

  if (!vault || !tokenIn || !tokenOut || !amount) {
    throw new Error(
      "Usage: --vault <address> --from <symbol|address> --to <symbol|address> --amount <human> [--preview-only] [--execute-if-ready] [--json]"
    );
  }

  const previewOnly = flags.has("--preview-only");
  const executeIfReady = flags.has("--execute-if-ready");
  const watchVault = flags.has("--watch-vault") || AUTO_WATCH_VAULTS;

  return {
    vault: ethers.getAddress(vault),
    tokenIn,
    tokenOut,
    amount,
    previewOnly,
    executeIfReady,
    json: flags.has("--json"),
    watchVault,
    deadlineSeconds: parseInt(values.get("--deadline-seconds") || "300", 10),
    tokenInDecimals: values.get("--token-in-decimals")
      ? parseInt(values.get("--token-in-decimals") || "18", 10)
      : undefined,
    tokenOutDecimals: values.get("--token-out-decimals")
      ? parseInt(values.get("--token-out-decimals") || "18", 10)
      : undefined,
  };
}

function formatAmount(raw: string, decimals: number): string {
  return ethers.formatUnits(raw, decimals);
}

function log(message: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${message}`);
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

function isPreviewReady(preview: ExecutionPreview): boolean {
  return (
    preview.riskFlags.length === 0 &&
    preview.quotedRoute.hasRouteData &&
    preview.quotedRoute.executionHash !== ethers.ZeroHash &&
    preview.quotedRoute.expectedOut !== "0"
  );
}

function printHumanSummary(result: DemoResult) {
  log(`Vault: ${result.vaultAddress}`);
  log(
    `Preview ${result.preview.ready ? "READY" : "NOT READY"} — ${result.humanAmountIn} ${result.tokenIn.symbol} -> ${result.tokenOut.symbol}`
  );
  log(
    `Expected out: ${result.preview.expectedOutFormatted} ${result.tokenOut.symbol} | Min out: ${result.preview.minAmountOutFormatted} ${result.tokenOut.symbol}`
  );
  log(`Fee: ${formatAmount(result.preview.feeAmount, 6)} ${result.preview.feeToken}`);

  if (result.preview.riskFlags.length > 0) {
    log(`Risk flags: ${result.preview.riskFlags.join(", ")}`);
  }

  for (const warning of result.preview.warnings) {
    log(`Warning: ${warning}`);
  }

  if (result.execution) {
    log(`Executed successfully — jobId: ${result.execution.jobId}`);
    log(`Tx hash: ${result.execution.txHash}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!CONTROLLER_PRIVATE_KEY) {
    throw new Error("Missing CONTROLLER_PRIVATE_KEY");
  }

  if (!SWAP_ADAPTER_ADDRESS) {
    throw new Error("Missing SWAP_ADAPTER_ADDRESS");
  }

  if (!RPC_URL) {
    throw new Error("Missing RPC_URL");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(CONTROLLER_PRIVATE_KEY, provider);
  const tokenIn = resolveDemoToken(options.tokenIn, options.tokenInDecimals);
  const tokenOut = resolveDemoToken(options.tokenOut, options.tokenOutDecimals);
  const amountIn = ethers.parseUnits(options.amount, tokenIn.decimals).toString();
  const nonce = Date.now();
  const deadline = Math.floor(Date.now() / 1000) + options.deadlineSeconds;

  let backendMode: string | undefined;
  let watchedVaults: number | undefined;

  try {
    const health = await apiCall<HealthResponse>("/health", "GET");
    if (health.status === 200) {
      backendMode = health.data.mode;
      watchedVaults = health.data.watchedVaults;
      log(`Backend health OK — mode: ${backendMode ?? "unknown"}`);
    } else {
      log(`Backend health returned ${health.status}`);
    }
  } catch (err) {
    log(`Backend health check failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (options.watchVault) {
    try {
      const watch = await apiCall<WatchResponse>("/indexer/watch", "POST", {
        vaults: [options.vault],
      });
      if (watch.status === 200) {
        log(`Indexer watch ensured for ${options.vault}`);
      }
    } catch (err) {
      log(`Indexer watch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const draftIntent: ExecutionIntent = {
    vaultAddress: options.vault,
    controller: wallet.address,
    adapter: SWAP_ADAPTER_ADDRESS,
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    amountIn,
    quotedAmountOut: "0",
    minAmountOut: "0",
    nonce,
    deadline,
    executionHash: ethers.ZeroHash,
  };

  log(
    `Running preview for ${options.amount} ${tokenIn.symbol} -> ${tokenOut.symbol} on vault ${options.vault}`
  );

  const previewResponse = await apiCall<ExecutionPreview>("/preview", "POST", {
    intent: draftIntent,
  } as PreviewRequest);

  if (previewResponse.status !== 200) {
    throw new Error(`Preview failed (${previewResponse.status}): ${JSON.stringify(previewResponse.data)}`);
  }

  const preview = previewResponse.data;
  const ready = isPreviewReady(preview);

  const result: DemoResult = {
    status: ready ? "preview-ready" : "preview-not-ready",
    vaultAddress: options.vault,
    tokenIn,
    tokenOut,
    humanAmountIn: options.amount,
    amountIn,
    backend: {
      url: OPERATOR_URL,
      mode: backendMode,
      watchedVaults,
    },
    preview: {
      ready,
      riskFlags: preview.riskFlags,
      warnings: preview.warnings,
      expectedOut: preview.quotedRoute.expectedOut,
      expectedOutFormatted: formatAmount(preview.quotedRoute.expectedOut, tokenOut.decimals),
      minAmountOut: preview.quotedRoute.minAmountOut,
      minAmountOutFormatted: formatAmount(preview.quotedRoute.minAmountOut, tokenOut.decimals),
      feeAmount: preview.estimatedFee.amount,
      feeToken: preview.estimatedFee.token,
      executionHash: preview.quotedRoute.executionHash,
      expiresAt: preview.expiresAt,
      policyCheckSummary: preview.policyCheckSummary,
    },
  };

  if (!ready || options.previewOnly || !options.executeIfReady) {
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    printHumanSummary(result);
    return;
  }

  const finalIntent: ExecutionIntent = {
    ...draftIntent,
    adapter: preview.quotedRoute.adapterAddress,
    quotedAmountOut: preview.quotedRoute.expectedOut,
    minAmountOut: preview.quotedRoute.minAmountOut,
    executionHash: preview.quotedRoute.executionHash,
  };

  const signature = await signIntent(wallet, finalIntent);
  log("Signed final intent");

  const firstExecute = await apiCall<PaymentChallenge>("/execute", "POST", {
    intent: finalIntent,
    signature,
  } as Partial<ExecuteRequest>);

  if (firstExecute.status !== 402) {
    throw new Error(
      `Expected 402 challenge before execution, got ${firstExecute.status}: ${JSON.stringify(firstExecute.data)}`
    );
  }

  const challenge = firstExecute.data;
  log(`Received 402 challenge — paying ${formatAmount(challenge.fee, 6)} to ${challenge.paymentAddress}`);

  const feeToken = new ethers.Contract(
    challenge.token,
    ["function transfer(address to, uint256 amount) returns (bool)"],
    wallet
  );

  const paymentTx = await feeToken.transfer(challenge.paymentAddress, challenge.fee);
  const paymentReceipt = await paymentTx.wait();
  const paymentReference = paymentReceipt.hash;

  const executeResponse = await apiCall<{ status: string; jobId: string; txHash: string }>(
    "/execute",
    "POST",
    {
      intent: finalIntent,
      signature,
      paymentReference,
    } as ExecuteRequest
  );

  if (executeResponse.status !== 200) {
    throw new Error(
      `Execution failed (${executeResponse.status}): ${JSON.stringify(executeResponse.data)}`
    );
  }

  result.status = "executed";
  result.execution = {
    jobId: executeResponse.data.jobId,
    txHash: executeResponse.data.txHash,
    paymentReference,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printHumanSummary(result);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
