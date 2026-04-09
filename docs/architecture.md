# X402 Operator — Architecture & Flow

## Overview

X402 Operator is an autonomous swap execution system on X Layer. Vault owners deposit capital and set risk policies; trading bots sign off-chain intents; an operator backend validates, charges a fee (x402 protocol), and executes the swap on-chain through the vault contract.

## Actors

| Actor | Role | Executes on-chain? |
|-------|------|--------------------|
| **Vault Owner** | Deploys vault, deposits capital, sets policy, authorizes controllers | Yes (admin txs) |
| **Trading Bot (Controller)** | Signs EIP-712 intents expressing swap decisions | Only the fee payment |
| **Operator (Backend)** | Validates intents, verifies payment, executes swaps through the vault | Yes (executeSwap) |
| **Contracts** | Enforce policy, custody funds, record receipts | — |

## Contracts

### OperatorVault

The vault is the user's on-chain safe. It holds ERC-20 tokens and enforces a risk policy on every swap.

**Owner-only functions:**

- `deposit(token, amount)` — Transfer tokens into the vault
- `withdraw(token, amount, to)` — Transfer tokens out
- `authorizeController(address)` / `revokeController(address)` — Manage which bots can request swaps
- `addAllowedToken(token)` / `removeAllowedToken(token)` — Manage output token allowlist
- `updatePolicy(maxPerTrade, maxDailyVolume, maxSlippage, cooldown)` — Adjust risk parameters
- `pause()` / `unpause()` — Emergency stop

**Operator-only function:**

- `executeSwap(intent, routeData, signature, paymentRef, registry, minAmountOut)` — Execute a validated swap

Even though only the operator can call `executeSwap`, the contract independently re-validates everything:

1. Recover the EIP-712 signer and verify it matches `intent.controller`
2. Check that the recovered controller is authorized
3. Check nonce has not been used (then mark it used)
4. Check deadline has not passed
5. Check `tokenIn == baseToken` and `tokenOut` is in the allowlist
6. Check amount does not exceed `maxAmountPerTrade`
7. Check daily volume cap (UTC day bucket)
8. Check cooldown period since last execution
9. Approve the trusted router and call it with `routeData`
10. Measure `balanceAfter - balanceBefore` for the output token
11. Check slippage: `amountOut >= minAmountOut`
12. Update volume and cooldown tracking
13. Emit `ExecutionSucceeded` and record a receipt in the registry

### ExecutionRegistry

A public ledger of execution receipts.

- `recordReceipt(receipt)` — Only callable by authorized vaults. Stores the full receipt (jobId, vault, controller, operator, tokens, amounts, timestamp, success) and increments `successCount[operator]`.
- `getReceipt(jobId)` — Retrieve a receipt by job ID.
- `getTrackRecord(operator)` — Returns the number of successful executions for an operator (reputation score).
- `authorizeFactory(factory)` — Allows a factory contract to register new vaults automatically.

### VaultFactory

Allows any user to deploy a vault from the frontend without writing code.

- `createVault(baseToken, maxPerTrade, maxDailyVolume, maxSlippage, cooldown)` — Deploys a new `OperatorVault`, auto-registers it in the `ExecutionRegistry`, and records the `owner → vault` mapping.
- `getVaultsByOwner(owner)` — Returns all vaults created by an owner.

### MockRouter (testnet only)

Simulates a DEX for testing. Receives `tokenIn`, returns `tokenOut` at 1:1 ratio. In production this is replaced by a real DEX router (e.g. OKX DEX).

## EIP-712 Typed Signatures

The bot never submits transactions to the vault directly. Instead, it signs a typed `ExecutionIntent`:

```
ExecutionIntent {
  vaultAddress:   address  // which vault to execute on
  controller:     address  // the bot's address (signer)
  tokenIn:        address  // input token (must match vault's baseToken)
  tokenOut:       address  // output token (must be in vault's allowlist)
  amount:         uint256  // amount of tokenIn to swap
  maxSlippageBps: uint256  // max slippage the bot accepts (basis points)
  nonce:          uint256  // anti-replay nonce
  deadline:       uint256  // unix timestamp expiry
}
```

Domain:

```
{
  name: "X402Operator",
  version: "1",
  chainId: <chain ID>,
  verifyingContract: <vault address>
}
```

The contract recovers the signer with `ECDSA.recover` on the EIP-712 digest and verifies it matches an authorized controller. This separates **who decides** (the bot) from **who executes** (the operator).

## The x402 Payment Protocol

Inspired by HTTP 402 (Payment Required). The operator charges a fee for execution gas and service.

### Step-by-step

**1. Free pre-validation** — The bot calls `POST /preview` with the intent. The backend reads the vault's on-chain policy, gets a swap quote, and returns a preview with risk flags, warnings, expected output, and the fee. No payment needed.

**2. First execute call (no payment)** — The bot calls `POST /execute` with `{intent, signature}` but no `paymentReference`. The backend validates the intent fully off-chain. If valid but unpaid, it responds **HTTP 402**:

```json
{
  "fee": "100000",
  "token": "0x9e29...FB0c",
  "paymentAddress": "0xF88A...570b",
  "message": "Payment required. Transfer the fee and re-submit with paymentReference."
}
```

**3. Bot pays the fee** — The bot sends an ERC-20 `transfer()` on-chain from itself to the operator's address for the required fee amount.

**4. Re-submit with proof** — The bot calls `POST /execute` again, now including `paymentReference` (the tx hash of the fee transfer). The backend:

- Fetches the transaction receipt on-chain
- Verifies there is a `Transfer` event where `from == controller`, `to == operator`, `amount >= fee`, and the token matches
- Checks the payment reference has not been used before (replay protection via persistent ledger)
- If valid, proceeds with execution

**5. Execution** — The backend calls `vault.executeSwap()` on-chain. On success, returns `{jobId, txHash}` to the bot.

### Why this matters

- The vault owner never pays gas for swaps
- The bot pays a small fee; the operator pays the `executeSwap` gas and recovers cost through the fee
- The vault only gains or loses based on swap outcomes, bounded by its policy

## Backend Services

### Route: POST /preview

1. Reads the vault's full policy snapshot from on-chain (13 parallel `view` calls)
2. Gets a swap quote from OnchainOS (or MockRouter on testnet)
3. Builds a `PolicyCheckSummary` checking all 8 policy constraints
4. Returns risk flags, warnings, fee info, and quoted route

### Route: POST /execute

1. **Validate intent off-chain** — Recover EIP-712 signer, check all policy constraints against on-chain state. This saves gas: if the intent would revert on-chain, reject it here without spending gas.
2. **Verify payment** (x402) — If no `paymentReference`, return 402. If provided, verify the on-chain transfer and check the ledger for replay.
3. **Execute** — Call `vault.executeSwap()` via the operator wallet. Parse the `ExecutionSucceeded` event for `amountOut`.
4. **Return** `{jobId, txHash, amountOut}`

### Route: GET /receipts/:jobId

Reads a receipt from the `ExecutionRegistry` contract.

### Route: GET /operator/track-record

Returns the operator's `successCount` from the registry.

### Service: Intent Validator

Reads a full policy snapshot from the vault in one batch (13 parallel calls):

- `authorizedControllers(controller)`
- `usedNonces(nonce)`
- `allowedTokens(tokenOut)`
- `baseToken()`, `maxAmountPerTrade()`, `maxDailyVolume()`, `maxSlippageBps()`
- `currentDay()`, `dailyVolumeUsed()`, `lastExecution()`, `cooldownSeconds()`
- `paused()`, `trustedRouter()`

Then evaluates the same 8 checks the contract would enforce. This is a gas-saving filter — if any check fails, the backend rejects the request without sending a transaction.

### Service: OnchainOS / Quote Provider

Responsible for generating `routeData` (the calldata the vault forwards to the router).

- **Testnet mode** (`USE_MOCK_ROUTER=true`): Encodes `MockRouter.swap(tokenIn, tokenOut, amountIn, amountOut)` calldata with a 1% spread.
- **Production mode**: Calls the OnchainOS Trade API to get a real DEX route with optimal pricing (TODO).

### Service: On-chain Executor

1. Gets a swap quote
2. Validates the router matches `vault.trustedRouter()`
3. Computes `jobId = keccak256(intentHash, paymentRef)`
4. Calculates `minAmountOut` using the effective slippage (min of policy and intent)
5. Sends `vault.executeSwap()` and waits for the receipt
6. Parses the `ExecutionSucceeded` event for `amountOut`

### Service: Payment Ledger

A persistent `Set<string>` backed by `payment-ledger.json`. Each payment reference (tx hash) can only be consumed once. Prevents replay attacks where a bot submits the same fee payment for multiple executions.

### Service: Event Indexer

Polls the chain every 5 seconds for vault events:

- Respects X Layer's 100-block `getLogs` limit by chunking requests
- Parses 7 event types: `ExecutionSucceeded`, `Deposit`, `Withdraw`, `ControllerAuthorized`, `ControllerRevoked`, `Paused`, `Unpaused`
- Fetches block timestamps for each event
- Deduplicates by `txHash + eventType`
- Persists to `vault-events.json` with `lastBlock` cursor for restart resilience
- Serves events via `GET /events/:vaultAddress`

## Frontend

React app with viem for blockchain interaction.

- **Wallet connection** — Direct `window.ethereum` provider, no wagmi dependency
- **Vault selector** — Lists vaults from `VaultFactory.getVaultsByOwner()` or manual address input
- **Create vault** — Calls `VaultFactory.createVault()` with user-defined policy
- **Dashboard** — Shows balances (USDT/USDC), policy parameters, daily volume usage
- **Owner actions** — Deposit, authorize/revoke controllers, add tokens, pause/unpause, update policy
- **History** — Fetches indexed events from backend, displays in a table with event badges, token names, controller addresses, and explorer links. Polls every 10 seconds.

## Security Model

| Risk | Mitigation |
|------|------------|
| Operator steals funds | Can only swap to allowlisted tokens, bounded by per-trade and daily volume limits, with slippage protection |
| Bot sends bad intent | On-chain policy enforcement rejects it (all 8 checks re-run in the contract) |
| Intent replay | Nonce is marked as used on-chain; cannot be reused |
| Payment replay | Payment ledger rejects already-consumed references |
| Operator charges but doesn't execute | Bot can verify execution via receipt in the ExecutionRegistry |
| Emergency | Owner calls `pause()` to block all execution immediately |
| Off-chain validation bypass | Irrelevant — the contract re-validates everything independently |

## Execution Flow Diagram

```
Bot                      Operator Backend                Vault Contract          Registry
 │                            │                              │                      │
 │  POST /preview {intent}    │                              │                      │
 │───────────────────────────>│  read policy + get quote     │                      │
 │                            │─────────────────────────────>│                      │
 │  {fee, riskFlags, quote}   │                              │                      │
 │<───────────────────────────│                              │                      │
 │                            │                              │                      │
 │  ERC20.transfer(fee) ──────────────────────────────────────────────────> chain   │
 │                            │                              │                      │
 │  POST /execute             │                              │                      │
 │  {intent, sig, paymentRef} │                              │                      │
 │───────────────────────────>│                              │                      │
 │                            │  1. validate intent offchain │                      │
 │                            │  2. verify payment onchain   │                      │
 │                            │  3. consume payment ref      │                      │
 │                            │  4. vault.executeSwap()      │                      │
 │                            │─────────────────────────────>│                      │
 │                            │                              │  re-validate all     │
 │                            │                              │  approve router      │
 │                            │                              │  router.call()       │
 │                            │                              │  check slippage      │
 │                            │                              │  record receipt ────>│
 │                            │                              │                      │
 │                            │  ExecutionSucceeded event    │                      │
 │                            │<─────────────────────────────│                      │
 │  {jobId, txHash}           │                              │                      │
 │<───────────────────────────│                              │                      │
```

## Deployed Contracts (X Layer Testnet)

| Contract | Address |
|----------|---------|
| ExecutionRegistry | `0x3d77c98D4E0f150Fd28D3A12708fd0300076ce97` |
| VaultFactory | `0xdA3f23F937d530120F1DeAcBDA08770b1CF99CA7` |
| MockRouter | `0x54Bf470359EaE4A9BEe20F587Df9dc20C333e25F` |
| Test Vault | `0x6C50552803c7f2E26ff3452cB768FA4A8d7969Cb` |
| USDT | `0x9e29b3AaDa05Bf2D2c827Af80Bd28Dc0b9b4FB0c` |
| USDC | `0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D` |
