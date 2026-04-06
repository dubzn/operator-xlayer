# 05. Vault Spec

## Purpose of the vault
The vault is the core custody and policy-enforcement primitive.

It exists to:
- hold user capital on X Layer
- enforce execution policy onchain
- allow constrained delegated execution
- prevent the operator from gaining arbitrary withdrawal power

Without the vault, the system becomes either a normal wallet-delegation scheme or a centralized API with soft promises.

## Mental model
The vault is not just a wallet. It is a wallet with hard, inspectable rules.

The easiest way to think about it is:
- the owner chooses the capital
- the owner chooses the rules
- the controller chooses when to request action
- the operator executes only if the vault says yes

The vault is where "yes" or "no" becomes enforceable.

## Core policy fields
The MVP vault policy should include:
- `owner`
- `authorizedOperator`
- `authorizedControllers`
- `allowedTokens`
- `maxAmountPerTrade`
- `maxDailyVolume`
- `maxSlippageBps`
- `cooldownSeconds`
- `paused`

Optional later additions are possible, but these fields are enough to prove the core thesis.

## Suggested state model
The implementation can change details, but conceptually the vault needs state for:
- owner identity
- authorized operator identity
- controller allowlist
- allowed token set
- used nonces
- daily volume accounting
- last execution timestamp
- paused flag
- current asset balances

## Owner actions
The owner should be able to:
- deposit capital into the vault
- pause execution
- unpause execution
- update policy fields
- authorize a controller
- revoke a controller
- withdraw capital

The owner is the policy source of truth, not the strategy engine.

## Operator actions
The operator should be able to:
- call a constrained execution function for valid intents
- emit or trigger receipt recording after execution

The operator must **not** be able to:
- withdraw vault funds to itself
- transfer arbitrary assets out of the vault outside approved execution paths
- execute without a valid intent and policy match
- re-use an old controller signature for a new job

## Minimum execution validation rules
Every execution attempt must validate at least the following:
- caller is the authorized operator
- referenced controller is currently authorized
- signed intent is valid for the controller
- nonce has not been used before
- deadline has not expired
- token pair is allowed by policy
- amount is within the single-trade limit
- daily volume remains under cap
- cooldown has been respected
- slippage remains within bounds
- vault is not paused

## Proposed MVP methods
The exact function names can change, but the vault should conceptually expose:
- `deposit(...)`
- `withdraw(...)`
- `pause()`
- `unpause()`
- `authorizeController(address)`
- `revokeController(address)`
- `updatePolicy(...)`
- `executeSwap(intent, routeData, signature, paymentRef, registryRef)`

The main design rule is that every path that moves capital during delegated execution must pass through the vault's checks.

## Why this exists instead of normal wallet delegation
Normal wallet delegation is simpler, but it creates broader power than we want.

With normal delegation:
- the agent or delegate often gets broad approval scope
- failures can become full-fund failures
- it is harder to prove which requests were owner-approved versus backend-created

With a policy vault:
- capital is isolated
- permissions are narrow
- policy is explicit and inspectable
- the operator can be paid for execution without ever owning the strategy capital

## MVP simplifications
For MVP, the vault should stay intentionally narrow:
- one operator address
- one or a small set of controller addresses
- spot-swap execution path first
- rebalance support only if it can be added without weakening clarity
- no generalized plugin execution inside the vault
- no complex asset-risk taxonomy inside the vault itself

The vault should prove the main concept, not try to become a universal automation account on day one.

## Examples of allowed and blocked behavior
### Allowed
- authorized controller signs `USDT -> ETH` for `800`
- operator submits it
- token pair is whitelisted
- amount is below max per trade
- cooldown passed
- slippage stays inside policy

### Blocked
- operator tries to move funds to its own wallet
- unauthorized controller signs an otherwise valid intent
- nonce is reused
- token is not whitelisted
- amount exceeds daily cap
- execution occurs while paused

These examples should directly inspire contract tests.
