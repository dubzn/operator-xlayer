# 09. Contract Plan

## MVP contracts
The MVP should use exactly two contracts:
- `OperatorVault.sol`
- `ExecutionRegistry.sol`

This is a deliberate reduction from more ambitious earlier variants.

## Explicitly excluded from MVP
- factory pattern
- elaborate reputation system
- insurance or claims logic
- generalized plugin execution
- multiple vault classes
- fully generalized task execution beyond constrained DeFi actions

## `OperatorVault.sol`
### Responsibilities
- store vault owner and policy state
- store authorized operator
- store authorized controller addresses
- hold vault capital
- validate signed intents
- enforce nonce and deadline rules
- enforce token, amount, volume, slippage, cooldown, and pause checks
- execute a constrained swap or rebalance action

### Suggested conceptual storage
- owner
- operator
- allowed controllers
- allowed tokens
- policy values
- nonce usage map
- daily volume accounting
- last execution timestamp
- paused flag

### Suggested events
- `Deposit`
- `Withdraw`
- `PolicyUpdated`
- `ControllerAuthorized`
- `ControllerRevoked`
- `ExecutionRequested` or equivalent pre-execution marker if useful
- `ExecutionSucceeded`
- `ExecutionFailed` only if failure logging is designed carefully

### Design goal
`OperatorVault.sol` must be the hard boundary that prevents the operator from acting like a broad custodian.

## `ExecutionRegistry.sol`
### Responsibilities
- store execution receipt metadata
- associate receipts with vault IDs and jobs
- expose a basic operator track record

### Track record fields
- `successCount`
- `failCount`
- `avgSlippageDeltaBps`
- `policyViolationCount`

### Suggested receipt fields
- job ID
- vault ID
- controller address
- operator address
- payment reference
- execution tx hash
- token in / token out
- amount in / amount out
- realized slippage or slippage delta
- timestamp
- status

This is intentionally a **track record**, not a complete reputation protocol.

## Contract design stance
The contracts should optimize for:
- policy enforcement clarity
- receipt usefulness
- small surface area
- easy reviewability for the team and judges

They should not try to become a full general-purpose automation framework in MVP.

## First implementation slice
- one vault deployment for the main demo
- one registry deployment
- one constrained execution function
- one receipt path
- enough events and getters to make the console and demo legible

## Minimum test plan implied by the design
The contracts should be written with these tests in mind:
- unauthorized operator cannot execute
- unauthorized controller signature is rejected
- reused nonce is rejected
- expired intent is rejected
- non-whitelisted token path is rejected
- amount above cap is rejected
- execution while paused is rejected
- successful execution emits enough data for a receipt path
- operator cannot withdraw arbitrary capital

If the contract design makes those tests awkward or impossible, the design is probably wrong.
