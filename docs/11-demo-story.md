# 11. Demo Story

## Hero framing
The demo should sell one message above all others:

**Delegated execution without surrendering custody.**

Do not present the product as a treasury-rebalancing dashboard. Treasury rebalance is just the first proof point.

## Demo target length
- ideal: 90 to 120 seconds
- acceptable: up to 3 minutes if the flow remains crisp

## Demo sequence

### 1. Show the problem
- Acknowledge the current tradeoff: broad wallet delegation is dangerous, manual signing kills autonomy.
- Introduce the promise: owners can define rules, agents can request execution, operators can get paid per job.

### 2. Show vault setup
- Open the console.
- Show a funded vault on X Layer.
- Show the policy fields.
- Show the authorized controller and operator.

### 3. Show the controller request
- Present a controller agent such as `TreasuryBot`.
- Show the exact typed `ExecutionIntent` it creates.
- Make clear this request is signed by the controller.

### 4. Show the `x402` step
- Hit the execute endpoint.
- Show the 402 challenge.
- Show the payment happening.

### 5. Show execution under guardrails
- Show the operator validating the request.
- Show the vault enforcing the policy.
- Emphasize that the operator cannot withdraw funds or bypass constraints.

### 6. Show the receipt
- Show the execution tx hash.
- Show the receipt in the registry or console.
- Show the operator track record updating.

## Demo tone
- focus on trust boundaries and verifiability
- avoid overclaiming autonomy or intelligence
- keep the product identity as infra, not consumer fintech

## First proof point
Use a single spot-swap or basic rebalance example in the first demo. The point is not to show financial sophistication. The point is to show the full loop clearly:
- controller decides
- caller pays
- operator executes
- vault constrains
- receipt proves it happened
