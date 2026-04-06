# 13. Build Plan

## Build strategy
The team should build from the trust boundary inward. Contracts and typed execution validation sit on the critical path. The console and polish come later.

## Workstreams

### Stream 1: Contracts
Owns:
- `OperatorVault.sol`
- `ExecutionRegistry.sol`
- events and getters
- tests for policy enforcement and replay protection

Definition of done:
- core authorization and policy tests pass
- contracts can be deployed to testnet or equivalent environment
- receipt path is stable enough for backend integration

### Stream 2: Backend / operator service
Owns:
- preview endpoint
- execute endpoint
- `x402` flow
- intent validation
- Onchain OS integrations

Definition of done:
- controller can hit preview
- execute returns 402 when unpaid
- valid paid request reaches contract path
- receipt data can be fetched after execution

### Stream 3: Demo agent + console
Owns:
- one controller demo agent
- lightweight vault and receipt console
- readable execution output

Definition of done:
- demo agent can build and sign a valid intent
- console can show policy, balances, receipts, and track record
- human viewer can understand the flow in under 2 minutes

### Stream 4: Docs and submission
Owns:
- public README
- diagrams and screenshots
- demo script
- submission materials

Definition of done:
- judges can understand the product from the repo alone
- demo script matches the working system
- diagrams use the same vocabulary as the contracts and API

## Dependency order
1. contract shapes and typed intent
2. vault validation tests
3. registry receipt shape
4. backend intent verification
5. x402 execute path
6. controller demo agent
7. console
8. polish and submission

## Suggested sequence for the hackathon

### Day 1
- initialize codebase from this docs-first repo
- settle final contract interfaces
- define typed `ExecutionIntent`
- settle exact policy fields and events
- assign owners for each workstream

### Day 2
- implement `OperatorVault.sol`
- implement basic tests for authorization, nonce, deadline, token checks, and pause behavior

### Day 3
- implement `ExecutionRegistry.sol`
- wire receipt events and track-record counters
- continue tests and finalize the contract integration boundary

### Day 4
- implement backend validation path
- implement signed intent verification
- integrate basic Onchain OS Trade flow
- align backend payloads with contract expectations

### Day 5
- add `x402` execute path
- ensure payment references can be linked to execution receipts
- integrate Market and Security if needed for preview and checks

### Day 6
- build one controller demo agent
- run end-to-end flows against test deployments
- harden receipt shape and debug transaction packaging

### Day 7
- build lightweight console
- show vault state, policy, receipts, and track record
- refine demo path and reduce visual noise

### Day 8
- deploy to X Layer mainnet if the system is stable
- produce real activity for the demo and the judges
- prepare README visuals and final docs polish

### Day 9
- record demo
- finalize submission
- keep scope frozen except for bug fixes

## Team split guidance
If multiple people are available:
- one person owns contracts and tests
- one person owns backend plus `x402`
- one person owns controller demo agent plus console
- one person owns docs, diagrams, and demo polish

The contract owner should be on the critical path early. The console should never block the contract and execution loop.

## What to cut first if time slips
Cut in this order:
1. rebalance support
2. richer preview logic
3. extra console polish
4. any stretch integration beyond core Onchain OS services

Do **not** cut:
- signed intents
- vault policy enforcement
- `x402` on execute
- receipt recording
