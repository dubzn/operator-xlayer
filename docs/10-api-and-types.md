# 10. API and Types

## API philosophy

The operator API should stay deterministic, typed, and small.

The controller should be able to integrate with a typed client, not by prompting a backend with fuzzy instructions.

## Core endpoints

### `POST /preview`

Purpose:

- build the signable execution package
- run free preflight checks
- return fee, quote, and risk context before payment

Request:

```json
{
  "intent": {
    "vaultAddress": "0xVault",
    "controller": "0xController",
    "adapter": "0xOkxAdapter",
    "tokenIn": "0xUSDT",
    "tokenOut": "0xUSDC",
    "amountIn": "800000000",
    "quotedAmountOut": "0",
    "minAmountOut": "0",
    "nonce": 47,
    "deadline": 1777777777,
    "executionHash": "0x0000000000000000000000000000000000000000000000000000000000000000"
  },
  "routePreferences": {
    "dexIds": ["1", "4"]
  }
}
```

Response:

```json
{
  "jobClass": "swap-v2",
  "vaultAddress": "0xVault",
  "estimatedFee": {
    "amount": "1000000",
    "token": "0xUSDT"
  },
  "quotedRoute": {
    "adapterAddress": "0xOkxAdapter",
    "routerAddress": "0xRouter",
    "hasRouteData": true,
    "expectedOut": "798500000",
    "minAmountOut": "790515000",
    "executionHash": "0xabc123..."
  },
  "riskFlags": [],
  "warnings": [],
  "routePreferencesApplied": {
    "dexIds": ["1", "4"]
  },
  "policyCheckSummary": {
    "controllerAuthorized": true,
    "adapterAllowed": true,
    "nonceAvailable": true,
    "inputTokenAllowed": true,
    "outputTokenAllowed": true,
    "pairAllowed": true,
    "amountWithinLimit": true,
    "withinDailyVolume": true,
    "cooldownMet": true,
    "vaultNotPaused": true,
    "policyMinAmountOut": "790515000"
  },
  "expiresAt": 1777777730
}
```

### `POST /execute`

Purpose:

- enforce `x402`
- validate the signed intent against the cached quote and live vault state
- submit `executeSwap(...)`

Request:

```json
{
  "intent": {
    "vaultAddress": "0xVault",
    "controller": "0xController",
    "adapter": "0xOkxAdapter",
    "tokenIn": "0xUSDT",
    "tokenOut": "0xUSDC",
    "amountIn": "800000000",
    "quotedAmountOut": "798500000",
    "minAmountOut": "790515000",
    "nonce": 47,
    "deadline": 1777777777,
    "executionHash": "0xabc123..."
  },
  "signature": "0xSignedTypedData",
  "paymentReference": "0xFeeTxHash"
}
```

Behavior:

- if unpaid, return HTTP `402`
- if paid and valid, return `status`, `jobId`, and `txHash`

### `GET /receipts/:jobId`

Purpose:

- fetch the public execution receipt from the registry

### `GET /operator/track-record`

Purpose:

- expose the operator's current success counter

## Core types

### `ExecutionIntent`

Current fields:

- `vaultAddress`
- `controller`
- `adapter`
- `tokenIn`
- `tokenOut`
- `amountIn`
- `quotedAmountOut`
- `minAmountOut`
- `nonce`
- `deadline`
- `executionHash`

Important note:

- the signature is over the typed intent
- the signature is **not** part of the intent itself
- the controller signs the quote package returned by preview

### `RoutePreferences`

Optional fields:

- `dexIds`
- `excludeDexIds`

These let the caller constrain or exclude venues inside the OKX Aggregator request.

### `ExecutionPreview`

Current fields:

- `jobClass`
- `vaultAddress`
- `estimatedFee`
- `quotedRoute`
- `riskFlags`
- `warnings`
- `routePreferencesApplied`
- `policyCheckSummary`
- `expiresAt`

### `ExecutionReceipt`

Current fields:

- `jobId`
- `vaultAddress`
- `controller`
- `operator`
- `adapter`
- `paymentReference`
- `tokenIn`
- `tokenOut`
- `amountIn`
- `amountOut`
- `timestamp`
- `status`

### `ExecuteResponse`

Current fields:

- `status`
- `jobId`
- `txHash`

### `TrackRecord`

Current fields:

- `operator`
- `successCount`

The onchain registry keeps the reputation surface intentionally simple for now.

## Canonical identifiers

- `vaultAddress` is the canonical vault identifier
- `intentHash` is the canonical identifier of the signed request
- `executionHash` is the hash of the exact cached `executionData`
- `jobId = keccak256(intentHash, paymentReference)` is the canonical identifier of a paid execution attempt

## Signed fields

The controller signature covers:

- vault address
- controller address
- adapter
- token pair
- amount
- quote-derived output bounds
- nonce
- deadline
- `executionHash`

This is stronger than signing only a loose swap request because the final signature is bound to the exact route package approved by preview.

## Signature standard

The current implementation uses EIP-712 with:

- `name = "X402Operator"`
- `version = "2"`
- `chainId = 196` by default
- `verifyingContract = vaultAddress`

The backend and the vault verify the same typed data digest.

## Replay protections

The current system uses:

- `nonce`
- `deadline`
- one-time payment references
- cached quote expiry

These protect against replay across the signature layer, payment layer, and route layer.

## Determinism rule

All payloads should remain deterministic and typed.

The operator must not accept fuzzy requests like:

- "rebalance into safety"
- "do whatever the market recommends"

Those belong to higher-level controller logic, not the execution API.
