# 15. Open Questions

These questions are intentionally isolated here so they do not drift across the rest of the docs.

## Resolved defaults

### 1. Controller authorization model

- The vault is the source of truth.
- The backend may keep a mirror view only for faster rejection and observability.

### 2. Preview pricing

- `POST /preview` is free.
- `POST /execute` remains the paid path.

### 3. Receipt shape

- The onchain registry stores successful execution receipts.
- The receipt now includes `adapter`.
- Richer analytics can still live offchain.

### 4. Execution scope

- The current product is swap-only.
- Each execution attempt is a single delegated swap.
- Simple rebalancing is possible through allowed pairs, but there is no batch rebalance primitive yet.

### 5. Vault identity

- `vaultAddress` is the canonical vault identifier.

### 6. Signature standard

- EIP-712 is required.
- `chainId = 196` by default.
- `verifyingContract = vaultAddress`.
- current domain version = `"2"`.

### 7. Policy semantics

- `maxDailyVolume` uses a UTC day bucket.
- `cooldownSeconds` applies per vault.
- `baseToken` still exists, but execution is not limited to `tokenIn = baseToken`.
- the vault derives `policyMinAmountOut` from `quotedAmountOut` and `maxSlippageBps`.
- the controller may sign a stricter `minAmountOut`, but not a weaker one.

### 8. Route binding

- Preview produces the final quote package.
- The controller signs `executionHash`.
- Execute must use the cached route that matches that hash.

## Remaining open questions

### 1. Multi-operator design

How should the system evolve from one configured operator path to a more open market of operators without losing clarity in policy and receipts?

### 2. Quote cache durability

Is the in-memory quote cache enough for the next phase, or should quote state become persistent to survive restarts and improve retries?

### 3. Future adapter roadmap

Which adapter comes next after OKX swap execution:

- direct venue-specific swaps
- LP management
- lending / staking

### 4. Frontend parity

When should the UI expose the full `swap-v2` admin surface:

- input tokens
- pairs
- adapters

### 5. Commercial policy

Should the operator fee stay attempt-based, or should the product eventually support refund rules or success-based pricing?
