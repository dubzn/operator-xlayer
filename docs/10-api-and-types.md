# 10. API and Types

## API philosophy
The backend contract with controller agents should be deterministic, typed, and small. The MVP must not rely on natural language parsing or fuzzy intent interpretation.

## Core endpoints

### `POST /preview`
Purpose:
- optional preflight response before execution
- may return quote, risk checks, and operator fee estimate

Suggested request:
- typed candidate execution payload
- no signature required if preview remains informational only

Suggested response:
- route summary
- fee estimate
- policy check summary
- warnings
- expiry timestamp

### `POST /execute`
Purpose:
- paid execution endpoint
- `x402`-protected in MVP

Suggested request:
- `ExecutionIntent`
- optional client metadata for observability

Suggested response:
- execution status
- `jobId`
- receipt reference
- tx hash when available

### `GET /receipts/:jobId`
Purpose:
- fetch the public execution receipt and any associated metadata

### `GET /operator/track-record`
Purpose:
- expose the simple operator execution history counters

## Core types

### `ExecutionIntent`
Minimum fields:
- `vaultAddress`
- `controller`
- `tokenIn`
- `tokenOut`
- `amount`
- `maxSlippageBps`
- `nonce`
- `deadline`
- `signature`

Suggested note:
- route data should not be blindly signed by the controller in MVP unless route stability is guaranteed; the controller signs the execution bounds, not every backend packaging detail

### `ExecutionPreview`
Suggested fields:
- `jobClass`
- `vaultAddress`
- `estimatedFee`
- `quotedRoute`
- `expectedOut`
- `riskFlags`
- `policyCheckSummary`
- `expiresAt`

### `ExecutionReceipt`
Suggested fields:
- `jobId`
- `vaultAddress`
- `controller`
- `operator`
- `paymentReference`
- `executionTxHash`
- `status`
- `tokenIn`
- `tokenOut`
- `amountIn`
- `amountOut`
- `slippageBps`
- `timestamp`

### `TrackRecord`
Suggested fields:
- `successCount`
- `failCount`
- `avgSlippageDeltaBps`
- `policyViolationCount`

In MVP, `failCount` and `policyViolationCount` are expected to be backend-derived analytics rather than native onchain registry counters.

## Canonical identifiers
- `vaultAddress` is the canonical identifier of a vault in MVP
- `intentHash` is the canonical identifier of the signed execution request
- `jobId = keccak256(intentHash, paymentReference)` is the canonical identifier of a paid execution attempt

Because MVP excludes a factory, there is no separate numeric vault ID that needs to be preserved.

## Signed fields
The controller signature should cover the typed fields that define the execution request:
- vault address
- controller address
- token pair
- amount
- max slippage
- nonce
- deadline

The signature must not be over a vague or partially backend-generated blob.

## Signature standard
MVP should use **EIP-712 typed data** with this domain:
- `name = "X402Operator"`
- `version = "1"`
- `chainId = 196`
- `verifyingContract = vaultAddress`

The backend and the vault must verify the same digest. MVP should assume an EOA controller path first.

## Replay protections
The MVP requires both:
- `nonce`
- `deadline`

A nonce stops exact replay. A deadline limits the lifetime of a valid intent.

## Determinism rule
All payloads in MVP should be deterministic and typed. There should be no endpoint that accepts fuzzy instructions like:
- "rebalance me into safety"
- "do what the market suggests"

Those can be layered on later by a higher-level controller agent, but not by the core operator service.

## Example `ExecutionIntent`
```json
{
  "vaultAddress": "0xVault",
  "controller": "0xController",
  "tokenIn": "0xUSDT",
  "tokenOut": "0xETH",
  "amount": "800000000",
  "maxSlippageBps": 200,
  "nonce": 47,
  "deadline": 1777777777,
  "signature": "0x..."
}
```

## Example `ExecutionReceipt`
```json
{
  "jobId": "job_47",
  "vaultAddress": "0xVault",
  "controller": "0xController",
  "operator": "0xOperator",
  "paymentReference": "0xPayment",
  "executionTxHash": "0xTxHash",
  "status": "success",
  "tokenIn": "0xUSDT",
  "tokenOut": "0xETH",
  "amountIn": "800000000",
  "amountOut": "298000000000000000",
  "slippageBps": 31,
  "timestamp": 1777777788
}
```

## Implementation rule of thumb
If a controller agent cannot integrate against the API with a typed client in an afternoon, the API surface is too fuzzy for MVP.
