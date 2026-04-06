# 03. System Architecture

## System summary
`X402 Operator` is a service and protocol split across onchain contracts and an offchain operator backend. The backend handles payment, validation, quoting, and transaction submission. The contracts hold capital, enforce policy, and record public receipts.

The design goal is to make the operator useful without making it a broad custodian. The operator earns fees by executing jobs. The vault enforces what jobs are allowed. The controller agent decides when to request a job. The registry creates accountability after the fact.

## Main components

### Caller agent
The caller agent is the strategy-side actor.

Responsibilities:
- decide when an action should happen
- build a typed `ExecutionIntent`
- sign the intent with its own identity
- pay the operator fee via `x402`
- consume the resulting receipt

Non-responsibilities:
- it does not hold the vault funds
- it does not enforce policy itself
- it does not bypass the operator or vault

### Operator backend
The operator backend is the paid execution service.

Responsibilities:
- expose `preview` and `execute` endpoints
- issue `402 Payment Required` on the paid execution path
- perform free pre-validation before issuing a paid execution challenge
- verify the payment and bind it to a specific job
- validate the controller signature, nonce, and deadline
- fetch route, quote, and optional market/security context
- call the vault execution function
- record or trigger receipt recording in the registry

Non-responsibilities:
- it is not the final source of truth for authorization
- it is not the strategy engine
- it should not own unrestricted strategy capital

### Operator wallet / identity
The operator wallet is the service identity on X Layer.

Responsibilities:
- receive operator fees
- submit transactions as the authorized operator
- represent the operator in receipts and track record

### Vault contract
The vault contract is the custody and enforcement primitive.

Responsibilities:
- hold the owner's capital
- store the current policy
- know the authorized operator
- know the authorized controller set
- validate execution conditions onchain
- execute only constrained actions

### Execution registry
The execution registry is the accountability layer.

Responsibilities:
- store execution receipts
- associate receipts with a vault and job
- expose a simple operator track record
- make the operator's activity auditable

### Onchain OS services
The operator consumes several Onchain OS services:
- Wallet / Agentic Wallet
- Trade / DEX
- Market
- Security

These services make the operator better informed and better integrated, but they do not replace the vault's enforcement role.

### x402 payment flow
The payment flow monetizes execution on a per-request basis.

Responsibilities:
- challenge callers before paid execution
- let other agents consume the operator as a paid API
- produce a payment event that can be linked to a specific signed intent and job

## End-to-end data flow
```text
owner -> create or initialize vault
owner -> deposit capital
owner -> set policy
owner -> authorize operator and controller

controller -> build ExecutionIntent for vaultAddress
controller -> sign ExecutionIntent
controller -> call operator /execute
operator -> pre-validate request
operator -> return 402 challenge
controller -> pay execution fee via x402
operator -> verify payment
operator -> derive intentHash and jobId
operator -> verify signature, nonce, deadline, allowlist
operator -> fetch route and checks
operator -> call vault execution function
vault -> validate policy and execute or revert
registry -> write execution receipt and update track record
viewer -> inspect tx + receipt + track record
```

## Deployment split

### X Layer mainnet
Contracts deployed on X Layer mainnet:
- `OperatorVault.sol`
- `ExecutionRegistry.sol`

These are the trust boundary and the public audit surface.

### Backend service
Offchain components:
- preview endpoint
- execute endpoint
- payment verification
- signed-intent validation
- Onchain OS client integrations
- transaction packaging and submission

### Lightweight web console
Human-facing support surface:
- vault policy view
- vault balance view
- recent execution receipts
- operator track record
- job inspection for demo and debugging

## Protocol versus product surface
The web console exists to make the system legible. It is not the product's core. The core product is the combination of:
- constrained capital custody in the vault
- signed execution intents from authorized controllers
- per-request operator monetization through `x402`
- onchain receipts that make the operator auditable

If the console vanished, the protocol would still exist. If the vault or the payment path vanished, the product thesis would not.

## Key boundaries
- **Authorization boundary:** controller allowlist plus signed intent
- **Custody boundary:** vault retains capital and enforces rules
- **Execution boundary:** operator can attempt execution but only through allowed methods
- **Monetization boundary:** `x402` fee is separate from vault capital
- **Audit boundary:** registry ties jobs to receipts and track record
- **Identity boundary:** the canonical vault identifier in MVP is the vault contract address

## Design constraints
- The backend cannot be the final source of truth for permissions.
- The operator must not be able to bypass vault policy.
- The same request cannot be replayed indefinitely.
- The payment model must be legible to other agents and judges.
- The MVP should remain small enough to implement during the hackathon.
- Every listed subsystem must contribute to the core loop rather than exist for feature inflation.
