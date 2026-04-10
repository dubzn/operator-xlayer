# 16. Detailed Execution Flow: Preview -> x402 -> Contracts

## Full flow

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  CONTROLLER AGENT                                                           │
│                                                                              │
│  1. Builds a draft preview request                                           │
│     { vaultAddress, controller, adapter, tokenIn, tokenOut, amountIn, ... } │
│                                                                              │
│  2. POST /preview                                                            │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  OPERATOR BACKEND — PREVIEW                                                  │
│                                                                              │
│  3. Reads the live vault state                                               │
│  4. Fetches an OKX DEX quote                                                 │
│  5. Derives policyMinAmountOut from quotedAmountOut                          │
│  6. Computes executionHash = keccak256(routeData)                            │
│  7. Caches the quote package by executionHash                                │
│  8. Returns preview { expectedOut, minAmountOut, executionHash, fee, ... }   │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  CONTROLLER AGENT                                                            │
│                                                                              │
│  9. Copies preview values into the final ExecutionIntent                     │
│  10. Signs EIP-712                                                           │
│      domain: { name: "X402Operator", version: "2",                           │
│                chainId: 196, verifyingContract: vaultAddress }               │
│                                                                              │
│  11. POST /execute with { intent, signature }                                │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  OPERATOR BACKEND — PAYMENT GATE                                             │
│                                                                              │
│  12. No paymentReference yet                                                 │
│      -> respond HTTP 402 Payment Required                                    │
│      -> include fee amount, fee token, operator payment address              │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  CONTROLLER AGENT                                                            │
│                                                                              │
│  13. Pays the fee via ERC-20 transfer                                        │
│  14. Re-sends POST /execute with paymentReference                            │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  OPERATOR BACKEND — VALIDATION                                               │
│                                                                              │
│  15. Loads cached quote by intent.executionHash                              │
│  16. Checks cached adapter == intent.adapter                                 │
│  17. Checks cached expectedOut == intent.quotedAmountOut                     │
│  18. Checks intent.minAmountOut >= cached policy floor                       │
│  19. Verifies x402 payment onchain                                           │
│  20. Verifies EIP-712 signature                                              │
│  21. Re-reads vault policy snapshot                                          │
│  22. Rejects early if nonce, policy, or expiry no longer fit                 │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  OPERATOR BACKEND — EXECUTION                                                │
│                                                                              │
│  23. Calls vault.executeSwap(intent, routeData, signature, paymentRef, ...)  │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  OPERATORVAULT.SOL                                                           │
│                                                                              │
│  24. Re-validates onchain:                                                   │
│      - operator caller                                                       │
│      - vault address                                                         │
│      - adapter allowlist                                                     │
│      - controller signature match                                            │
│      - controller allowlist                                                  │
│      - nonce                                                                 │
│      - deadline                                                              │
│      - input/output token allowlists                                         │
│      - pair allowlist                                                        │
│      - per-trade cap                                                         │
│      - daily volume                                                          │
│      - cooldown                                                              │
│      - executionHash                                                         │
│      - policy floor for minAmountOut                                         │
│                                                                              │
│  25. Delegatecalls the selected swap adapter                                 │
│  26. Validates realized amountOut >= intent.minAmountOut                     │
│  27. Updates accounting and emits ExecutionSucceeded                         │
│  28. Records a receipt in ExecutionRegistry                                  │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  EXECUTIONREGISTRY                                                           │
│                                                                              │
│  29. Stores { jobId, vault, controller, operator, adapter, paymentRef, ... }│
│  30. Increments operator successCount                                        │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  OPERATOR BACKEND                                                            │
│                                                                              │
│  31. Returns { status: "success", jobId, txHash }                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

## The 4 key boundaries

| Boundary | What it answers |
|---|---|
| **Preview** | "What exact swap package am I being asked to sign?" |
| **EIP-712 signature** | "Did the controller approve this exact execution package?" |
| **x402 payment** | "Did the caller pay for the execution service?" |
| **Vault policy** | "Does the owner's onchain policy still allow this swap?" |

## Redundant validation by design

The backend validates before spending gas. The vault validates again onchain before moving capital.

That redundancy is intentional:

- backend filtering saves gas
- vault validation is the hard security boundary

## Key identifiers

- `intentHash` = hash of the signed EIP-712 intent
- `executionHash` = hash of the exact cached calldata
- `jobId = keccak256(intentHash, paymentReference)` = canonical identifier of a paid execution attempt

## What the controller signs

The controller signs:

- vault address
- controller address
- adapter
- token pair
- amount
- quote-derived output bounds
- nonce
- deadline
- `executionHash`

The controller is therefore approving the exact execution package that the operator can submit, not just a vague instruction to trade.
