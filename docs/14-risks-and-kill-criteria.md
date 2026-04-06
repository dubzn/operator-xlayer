# 14. Risks and Kill Criteria

## Top risks

### 1. The operator feels like a centralized backend with a contract wrapper
If the operator can effectively do whatever it wants and the contracts only mirror backend choices, the idea loses its core value.

### 2. Receipts are not sufficiently verifiable
If receipts are just backend-written summaries with weak ties to onchain facts, they will not carry much weight with judges or future integrators.

### 3. `x402` becomes decorative
If the product could remove `x402` without changing the flow meaningfully, the payment layer is not central enough.

### 4. Vault policy enforcement is too weak
If the vault does not strongly enforce amount, token, slippage, and replay constraints, the custody story collapses.

### 5. Scope creep
Extra agents, marketplace features, or scoring layers can easily crowd out the core implementation.

## Kill criteria
Stop or rescope immediately if any of the following becomes true:
- signed intents are not enforced
- the operator can bypass vault rules
- `x402` is not central to paid execution
- the demo cannot communicate differentiated value in under 2 minutes

## Why a casual user would not need this
A person doing a one-off manual swap does not need:
- vault setup
- controller authorization
- operator fees
- onchain execution receipts

That is acceptable. The product is not trying to replace casual manual execution. It exists for systems that need repeated, policy-bounded automation.

## What must survive implementation
Even if the MVP gets simplified further, it must still preserve:
- custody separation
- policy-constrained execution
- signed controller intent
- per-request `x402` payment
- public receipt trail

If any of those disappear, the project should be reconsidered rather than cosmetically patched.
