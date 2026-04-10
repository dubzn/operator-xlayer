# X402 Operator — Architecture & Flow

## Overview

X402 Operator is a delegated swap execution system on X Layer.

The owner keeps capital in a vault. A controller agent asks for a swap. The operator backend previews the route, charges via `x402`, and submits execution. The vault is the hard trust boundary: it re-validates the signed intent, enforces policy, and records the receipt.

Today the product is intentionally `swap-v2`, not universal DeFi automation.

## Actors

| Actor | Role | Onchain actions |
|---|---|---|
| **Vault Owner** | Deposits capital, configures policy, authorizes controllers | Yes |
| **Controller Agent** | Requests swaps and signs EIP-712 intents | Fee payment only |
| **Operator Backend** | Previews, validates, charges `x402`, and calls `executeSwap` | Yes |
| **Vault / Registry** | Enforce policy, custody funds, store receipts | Native contracts |

## Contract system

### OperatorVault

The vault is the custody and policy primitive. It holds ERC-20 balances and decides whether a delegated swap is allowed.

**Current state surface**

- `owner`
- `baseToken`
- `authorizedOperator`
- `authorizedControllers`
- `allowedInputTokens`
- `allowedTokens` (output allowlist)
- `allowedPairs[tokenIn][tokenOut]`
- `allowedSwapAdapters`
- `usedNonces`
- `maxAmountPerTrade`
- `maxDailyVolume`
- `maxSlippageBps`
- `cooldownSeconds`
- `paused`
- `currentDay`, `dailyVolumeUsed`, `lastExecution`

**Owner functions**

- `deposit(token, amount)`
- `withdraw(token, amount, to)`
- `authorizeController(controller)` / `revokeController(controller)`
- `addAllowedInputToken(token)` / `removeAllowedInputToken(token)`
- `addAllowedToken(token)` / `removeAllowedToken(token)`
- `allowPair(tokenIn, tokenOut)` / `revokePair(tokenIn, tokenOut)`
- `allowSwapAdapter(adapter)` / `revokeSwapAdapter(adapter)`
- `updatePolicy(maxAmountPerTrade, maxDailyVolume, maxSlippageBps, cooldownSeconds)`
- `pause()` / `unpause()`

**Operator function**

- `executeSwap(intent, executionData, signature, paymentRef, registry)`

### What `executeSwap` enforces onchain

The vault independently re-validates the full execution request:

1. vault is not paused
2. `intent.vaultAddress == address(this)`
3. selected adapter is allowlisted
4. recovered signer matches `intent.controller`
5. recovered controller is authorized
6. nonce has not been used
7. deadline has not expired
8. `tokenIn` is allowlisted
9. `tokenOut` is allowlisted
10. `tokenIn -> tokenOut` pair is allowlisted
11. `amountIn <= maxAmountPerTrade`
12. daily volume cap is respected
13. cooldown has elapsed
14. `keccak256(executionData) == intent.executionHash`
15. `intent.minAmountOut` is not weaker than the vault policy floor derived from `quotedAmountOut`
16. adapter execution succeeds
17. realized `amountOut >= intent.minAmountOut`

Only after that does the vault emit `ExecutionSucceeded` and record a receipt.

### OkxAggregatorSwapAdapter

The vault is venue-flexible, but the first adapter is the OKX swap adapter.

Responsibilities:

- approve `tokenIn` for the OKX approval target
- call the OKX router with the backend-provided calldata
- measure `amountOut` as the change in `tokenOut` balance

Why the adapter layer matters:

- the vault is no longer hardwired to one router shape
- the execution venue is explicitly part of policy
- future adapters can be added without redesigning the vault surface

The backend currently supports one configured adapter: the OKX adapter.

### ExecutionRegistry

The registry is the onchain receipt ledger.

Each receipt stores:

- `jobId`
- `vault`
- `controller`
- `operator`
- `adapter`
- `paymentRef`
- `tokenIn`
- `tokenOut`
- `amountIn`
- `amountOut`
- `timestamp`
- `success`

The registry also tracks a simple `successCount` per operator.

### VaultFactory

The factory lets users create vaults from the UI without manual contract deployment.

Current constructor shape:

- `registry`
- `operator`
- `defaultSwapAdapter`

`createVault(...)` deploys a new `OperatorVault`, auto-registers it in the registry, and tracks the vault under the owner address.

## EIP-712 intent model

The current typed intent is:

```text
ExecutionIntent {
  vaultAddress:    address
  controller:      address
  adapter:         address
  tokenIn:         address
  tokenOut:        address
  amountIn:        uint256
  quotedAmountOut: uint256
  minAmountOut:    uint256
  nonce:           uint256
  deadline:        uint256
  executionHash:   bytes32
}
```

Domain:

```text
{
  name: "X402Operator",
  version: "2",
  chainId: <chain ID>,
  verifyingContract: <vault address>
}
```

### Why `executionHash` matters

The controller is no longer signing only generic swap bounds. It signs:

- the selected adapter
- the quote-derived output expectation
- the minimum acceptable output
- a hash of the exact calldata that the operator will submit

That gives the system a stronger binding between preview and execution without forcing the controller to reason about the full router payload directly.

## API flow

### `POST /preview`

Purpose:

- read the current vault policy snapshot
- fetch a route from OKX DEX
- derive policy warnings before charging
- return a quote package the controller can sign

What happens:

1. backend reads vault policy and state
2. backend resolves optional `dexIds` / `excludeDexIds`
3. backend requests a quote from OKX DEX
4. backend computes:
   - `expectedOut`
   - `policyMinAmountOut`
   - `executionHash = keccak256(routeData)`
   - `expiresAt`
5. backend caches the quote by `executionHash`
6. backend returns:
   - fee estimate
   - routed adapter and router info
   - risk flags and warnings
   - policy check summary
   - route preferences applied

The controller should treat the preview as the source of truth for the final values it signs.

### `POST /execute`

Purpose:

- enforce payment
- validate the signed request against the cached quote and live vault state
- submit the onchain execution

What happens:

1. backend loads the cached quote by `intent.executionHash`
2. backend checks:
   - quote exists and is not expired
   - cached adapter matches `intent.adapter`
   - cached `expectedOut` matches `intent.quotedAmountOut`
   - `intent.minAmountOut` is not below the cached policy floor
3. backend validates the EIP-712 signature and live vault state
4. if unpaid, backend returns HTTP `402`
5. if paid, backend verifies the payment transfer onchain
6. backend calls `vault.executeSwap(...)`
7. backend returns `jobId` and tx hash

### `GET /receipts/:jobId`

Returns the receipt recorded in the `ExecutionRegistry`.

### `GET /operator/track-record`

Returns the current operator success count from the registry.

## x402 payment model

The fee and the vault capital are intentionally separated.

- the controller pays the operator
- the operator pays gas for `executeSwap`
- the vault capital is only exposed to the result of the swap itself

This matters because the caller can be:

- the owner's own bot
- a third-party agent
- a marketplace task runner

`x402` is the pricing rail between the controller and the operator service.

## Quote source

The backend uses the OKX DEX Aggregator API for live swap routing.

Current behavior:

- fetch swap calldata from OKX
- optionally constrain routing with `OKX_DEX_IDS`
- optionally exclude venues with `OKX_EXCLUDE_DEX_IDS`
- cache the route keyed by `executionHash`

Important boundary:

- OKX provides routing
- X402 Operator provides custody separation, authorization, quote binding, and policy enforcement

## Agent flow

The reference agent in `packages/agent` runs this loop:

1. build a draft intent with placeholder quote values
2. call `POST /preview`
3. copy `expectedOut`, `minAmountOut`, and `executionHash` into the final intent
4. sign the final intent
5. call `POST /execute`
6. pay the `402` fee
7. re-submit with `paymentReference`

This is important for the pitch because it shows that the controller signs the **final** execution bounds, not just a vague trade request.

## Frontend status

The frontend is already useful for vault creation, monitoring, deposits, controller management, and history.

The newest `swap-v2` admin surfaces live first in contracts and API:

- input token allowlists
- pair allowlists
- adapter allowlists

Those can be added to the UI next without changing the contract model again.

## Security model

| Risk | Mitigation |
|---|---|
| Operator tries to change the route after preview | `executionHash` is signed and re-checked onchain |
| Operator tries a disallowed venue | adapter must be allowlisted in the vault |
| Controller is compromised | controller is still constrained by token, pair, amount, slippage, daily volume, and cooldown policy |
| Backend validation is bypassed | irrelevant for custody; the vault re-validates everything onchain |
| Payment replay | payment references are consumed once |
| Intent replay | nonces are consumed onchain |
| Emergency | owner can pause or revoke controllers immediately |

## Product boundary today

The strongest honest framing is:

- **today:** secure delegated swap execution
- **next:** more swap venues or richer execution adapters
- **later:** protocol-specific actions such as LP, lending, or staking

That is why the current implementation is credible: it solves one important thing well instead of pretending to solve every agent workflow at once.
