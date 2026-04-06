# 15. Open Questions

These questions are intentionally isolated here so they do not drift across the rest of the docs.

## Resolved defaults

### 1. Controller authorization model
- The vault is the source of truth.
- The backend may keep a mirror allowlist for faster rejection and observability only.

### 2. Preview pricing
- `POST /preview` is free in MVP.
- `POST /execute` remains the central paid path.

### 3. Receipt shape
- The onchain registry stores successful execution receipts only in MVP.
- Failure analytics may still exist offchain.

### 4. Rebalance support
- MVP is single-swap only.
- Rebalance is not part of the first implementation slice.

### 5. Vault identity
- `vaultAddress` is the canonical vault identifier in MVP.

### 6. Signature standard
- EIP-712 is the required signing model.
- `chainId = 196`
- `verifyingContract = vaultAddress`

### 7. Policy semantics
- `maxDailyVolume` uses a UTC day bucket.
- `cooldownSeconds` applies per vault.
- effective max slippage is `min(policy.maxSlippageBps, intent.maxSlippageBps)`.
- MVP uses a `baseToken`, and `tokenIn = baseToken`.

## Remaining open questions

### 1. Compact versus rich receipt data
How compact should the onchain receipt be before the registry becomes too expensive or too weak?

### 2. Backend analytics shape
What exact offchain metrics should power the operator console beyond the onchain success counters?

### 3. Portfolio integration
Portfolio remains stretch-only. The only question left is whether it adds enough value later to justify implementation effort.
