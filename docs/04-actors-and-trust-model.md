# 04. Actors and Trust Model

## Why this document matters
This project only makes sense if the trust boundaries are clear. The product claim is not "the operator is magically trustworthy". The claim is that the system reduces the amount of trust required by isolating roles and pushing the hard rules onchain.

## Actors

### Vault owner
The owner provides the capital and defines the policy.

**Can do:**
- deposit funds
- pause and unpause execution
- update policy parameters
- authorize controller agents
- revoke controller agents
- withdraw funds
- inspect receipts and track record

**Cannot do in the normal flow:**
- bypass the vault's own execution rules once an execution is attempted
- treat `x402` payment as a substitute for policy

### Authorized controller agent
The controller is the strategy-side actor. It decides when to request a job.

**Can do:**
- construct a typed `ExecutionIntent`
- sign that intent
- submit preview requests
- submit execution requests
- pay the operator fee via `x402`

**Cannot do:**
- move vault capital directly
- execute against an unapproved vault
- authorize itself on a vault
- override owner-defined policy
- skip nonce and deadline protections

### Operator
The operator is the execution service.

**Can do:**
- verify payment
- verify signatures and typed payloads
- reject malformed or unauthorized jobs early
- fetch route, quote, and safety context
- call the vault's constrained execution method
- write or trigger receipt recording

**Cannot do:**
- withdraw vault funds arbitrarily
- use `x402` payment alone as vault authorization
- invent a controller-approved action if the signature path is implemented correctly
- skip vault validation and still access capital

### Viewer / judge / auditor
This actor is not part of execution, but matters for credibility.

**Can do:**
- inspect vault configuration
- inspect the execution tx hash
- inspect the receipt and track record
- compare what was requested against what was executed

## Trust assumptions
- The **owner trusts the vault contract** to enforce the declared policy.
- The **owner does not fully trust the operator** with arbitrary custody.
- The **controller does not need direct capital access** to be useful.
- The **operator is trusted only to attempt allowed executions** and to service valid paid requests honestly.
- The **registry is meaningful only if receipts are tied to real execution facts** and not just backend-written summaries.

## Security invariants
- Vault capital never becomes a general-purpose operator balance.
- `x402` pays for service access, **not** fund custody or trade capital.
- Caller authorization comes from **onchain allowlist plus signed intent**, not from `x402` alone.
- Every execution must be bound to a nonce and deadline.
- The vault must re-validate what the backend already checked.
- The operator must not have a generic withdrawal path.

## What still requires trust
The design is trust-minimized, not trust-free.

Some trust remains because:
- the operator decides whether to serve a valid request
- the operator chooses how to package a transaction using quote data
- the operator may be temporarily offline or censor specific jobs

That remaining trust is acceptable only because the system also ensures:
- the operator cannot take arbitrary vault funds
- the operator cannot claim a controller approved something if signatures are enforced correctly
- the operator cannot bypass the vault's hard rules

## Failure modes and expected responses

### Controller key compromise
Risk:
- an attacker can sign intents for that controller

Expected owner response:
- pause vault
- revoke controller
- update policy if needed

### Operator downtime
Risk:
- valid jobs are delayed or unserved

Expected response:
- no capital loss from the downtime alone
- future versions may support operator rotation, but MVP only needs pause and visible failure boundaries

### Replay of an old intent
Risk:
- a previously valid execution request is submitted again

Required defense:
- nonce tracking
- deadline enforcement

### Quote drift or market movement
Risk:
- a route is valid at preview time but not at execution time

Required defense:
- the vault enforces max slippage
- the operator refreshes quote or aborts

### Weak receipt model
Risk:
- the registry becomes a marketing log instead of an audit artifact

Required defense:
- receipts reference actual transaction outcomes and payment references

## Bottom line
The system works only if each actor has a narrow role:
- owner defines policy and owns capital
- controller decides when to request action
- operator performs paid execution
- vault enforces what is allowed
- registry makes the outcome inspectable

If any actor starts doing too many of those jobs, the design becomes much weaker.
