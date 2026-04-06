# 07. x402 Integration

## What `x402` is doing here
`x402` is the operator's monetization layer. It allows the operator to sell execution as an API-native, agent-friendly service.

The important point is that `x402` pays for **service access**, not for capital custody.

## The two money flows

### 1. Vault capital
This is the owner's strategy capital.
- lives inside the vault
- is used for the actual swap or rebalance
- is subject to vault policy
- is never equivalent to the operator's fee

### 2. Operator execution fee
This is what the caller agent pays to `X402 Operator` for performing the service.
- paid via `x402`
- belongs to the operator
- should be tied to a specific job or request
- should be referenced in the execution receipt

These flows must stay separate in every document and implementation.

## What `x402` is used for
- pay-per-execution API access
- making the operator naturally consumable by other agents
- creating a clean earn loop for the operator
- producing a payment event that can be tied to an execution job

## What `x402` is not used for
- moving vault capital
- proving the caller is authorized for a given vault
- replacing controller signatures
- replacing nonce or deadline protection

A valid `x402` payment means the caller paid for service. It does **not** mean the caller is allowed to operate a vault.

## Endpoint model
### `POST /preview`
- default assumption for MVP: free
- may become a low-cost paid endpoint later if abuse becomes a problem

### `POST /execute`
- always `x402`-protected in MVP
- returns a 402 challenge before execution if payment is missing

## Seller flow
1. Caller sends execution request.
2. Operator responds with `402 Payment Required`.
3. Caller pays the required execution fee.
4. Operator verifies the payment.
5. Operator validates the signed intent and vault permissions.
6. Operator executes the job.
7. Operator settles and records the execution receipt.

## Buyer flow
1. Caller agent creates the `ExecutionIntent`.
2. Caller agent signs it.
3. Caller agent pays the operator fee with its wallet through `x402`.
4. Caller agent receives the execution result and receipt reference.

## MVP payment assumptions
- one fixed or simply parameterized fee per execution class
- no subscription logic
- no credit bundles
- no `pay-with-any-token` in MVP unless it becomes trivial to add without delaying the core flow

The clean story is enough: a controller agent pays the operator to execute a constrained job.
