# 15. Open Questions

These questions are intentionally isolated here so they do not drift across the rest of the docs.

## 1. Controller authorization model
Should controller authorization live only in the vault, or should the backend also maintain a mirror allowlist for faster rejection and observability?

**Current default:** the vault is the source of truth, and the backend may mirror state for convenience only.

## 2. Preview pricing
Should `POST /preview` stay free, or should it become a cheap paid endpoint to discourage abuse?

**Current default:** keep preview free in MVP and reserve `x402` for execution.

## 3. Receipt shape
Should receipts be fully onchain, or should the registry store a compact onchain receipt with richer offchain details keyed by tx hash and job ID?

**Current default:** store the minimum useful receipt data onchain and avoid bloated registry writes.

## 4. Rebalance support
Should MVP support only single swaps, or should it include a minimal rebalance operation?

**Current default:** single swap first, rebalance only if it lands naturally after the core flow is stable.

## 5. Portfolio integration
Does Portfolio add enough value to receipt snapshots or monitoring to justify the extra integration cost?

**Current default:** treat Portfolio as stretch-only.
