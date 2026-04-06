import { ethers } from "ethers";
import { signIntent } from "@x402-operator/shared";
import type { ExecutionIntent, ExecuteRequest, PaymentChallenge } from "@x402-operator/shared";

// --- Config from env ---
const OPERATOR_URL = process.env.OPERATOR_URL || "http://localhost:3000";
const CONTROLLER_PRIVATE_KEY = process.env.CONTROLLER_PRIVATE_KEY!;
const VAULT_ADDRESS = process.env.VAULT_ADDRESS!;
const TOKEN_IN = process.env.TOKEN_IN!;   // e.g. USDT address
const TOKEN_OUT = process.env.TOKEN_OUT!;  // e.g. WETH address
const SWAP_AMOUNT = process.env.SWAP_AMOUNT || "100000000"; // 100 USDT (6 decimals)
const FEE_TOKEN = process.env.FEE_TOKEN!;
const RPC_URL = process.env.RPC_URL!;

async function main() {
  console.log("=== X402 Operator Demo Agent ===\n");

  // Setup
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const controllerWallet = new ethers.Wallet(CONTROLLER_PRIVATE_KEY, provider);
  const controllerAddress = controllerWallet.address;

  console.log(`Controller: ${controllerAddress}`);
  console.log(`Vault: ${VAULT_ADDRESS}`);
  console.log(`Swap: ${SWAP_AMOUNT} ${TOKEN_IN} → ${TOKEN_OUT}\n`);

  // 1. Build ExecutionIntent
  const intent: ExecutionIntent = {
    vaultAddress: VAULT_ADDRESS,
    controller: controllerAddress,
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amount: SWAP_AMOUNT,
    maxSlippageBps: 200,
    nonce: Date.now(),
    deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes
  };

  console.log("1. Built ExecutionIntent:", JSON.stringify(intent, null, 2));

  // 2. Sign EIP-712
  const signature = await signIntent(controllerWallet, intent);
  console.log(`\n2. Signed intent: ${signature.slice(0, 20)}...`);

  // 3. POST /execute — expect 402
  console.log("\n3. Calling POST /execute (expecting 402)...");
  const firstRequest: Partial<ExecuteRequest> = { intent, signature };

  const firstResponse = await fetch(`${OPERATOR_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(firstRequest),
  });

  if (firstResponse.status !== 402) {
    console.error(`Unexpected status: ${firstResponse.status}`);
    console.error(await firstResponse.text());
    process.exit(1);
  }

  const challenge: PaymentChallenge = await firstResponse.json();
  console.log("   Got 402 challenge:", challenge);

  // 4. Pay the fee
  console.log("\n4. Paying operator fee...");
  const feeToken = new ethers.Contract(
    challenge.token,
    ["function transfer(address to, uint256 amount) returns (bool)"],
    controllerWallet
  );

  const payTx = await feeToken.transfer(challenge.paymentAddress, challenge.fee);
  const payReceipt = await payTx.wait();
  const paymentReference = payReceipt.hash;
  console.log(`   Payment tx: ${paymentReference}`);

  // 5. Re-POST /execute with paymentReference
  console.log("\n5. Re-calling POST /execute with payment proof...");
  const secondRequest: ExecuteRequest = { intent, signature, paymentReference };

  const secondResponse = await fetch(`${OPERATOR_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(secondRequest),
  });

  const result = await secondResponse.json();

  if (secondResponse.ok) {
    console.log("\n=== Execution Successful ===");
    console.log(`   JobId: ${result.jobId}`);
    console.log(`   TxHash: ${result.txHash}`);
  } else {
    console.error("\n=== Execution Failed ===");
    console.error(result);
  }
}

main().catch(console.error);
