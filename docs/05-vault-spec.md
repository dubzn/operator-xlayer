# 05. Vault Spec

## Purpose of the vault

The vault is the core custody and policy primitive.

It exists to:

- hold the owner's capital on X Layer
- enforce swap policy onchain
- let a controller request execution without receiving full wallet power
- keep the operator on a constrained path

Without the vault, the product collapses into either broad wallet delegation or a backend service with soft promises.

## Mental model

The easiest way to think about the vault is:

- the owner chooses the capital
- the owner chooses the rules
- the controller chooses when to request a swap
- the operator executes only if the vault says yes

The vault is where delegated execution becomes enforceable.

## Canonical identifier

The canonical vault identifier is the vault contract address.

That means:

- API payloads use `vaultAddress`
- the EIP-712 domain binds the intent to that address
- the vault address is the stable identifier across preview, execute, and receipts

## Current policy surface

The current `swap-v2` vault policy includes:

- `owner`
- `baseToken`
- `authorizedOperator`
- `authorizedControllers`
- `allowedInputTokens`
- `allowedTokens`
- `allowedPairs`
- `allowedSwapAdapters`
- `maxAmountPerTrade`
- `maxDailyVolume`
- `maxSlippageBps`
- `cooldownSeconds`
- `paused`

This is enough to prove the core thesis without opening arbitrary execution.

## Suggested state model

Conceptually the vault needs state for:

- owner identity
- operator identity
- controller allowlist
- input token allowlist
- output token allowlist
- pair allowlist
- adapter allowlist
- used nonces
- daily volume accounting
- last execution timestamp
- paused flag

## Owner actions

The owner can:

- deposit capital
- withdraw capital
- authorize or revoke controllers
- allow or remove input tokens
- allow or remove output tokens
- allow or revoke pairs
- allow or revoke adapters
- update the risk policy
- pause or unpause the vault

The owner is the policy source of truth, not the execution engine.

## Operator actions

The operator can:

- call `executeSwap(...)` for a valid signed request

The operator cannot:

- withdraw funds arbitrarily
- bypass the controller signature
- bypass pair policy
- switch venues unless the vault allows the adapter
- reuse an old signature or nonce

## Current signed intent shape

The controller signs:

```text
ExecutionIntent {
  vaultAddress
  controller
  adapter
  tokenIn
  tokenOut
  amountIn
  quotedAmountOut
  minAmountOut
  nonce
  deadline
  executionHash
}
```

This is stronger than the earlier MVP shape because the final intent now includes:

- the execution venue (`adapter`)
- the quote used for policy evaluation (`quotedAmountOut`)
- the minimum acceptable output (`minAmountOut`)
- a hash of the exact calldata to be executed (`executionHash`)

## Minimum execution validation rules

Every delegated swap must validate at least:

- caller is the authorized operator
- controller signature is valid
- recovered signer matches `intent.controller`
- controller is currently authorized
- nonce is unused
- deadline is valid
- input token is allowlisted
- output token is allowlisted
- pair is allowlisted
- adapter is allowlisted
- amount respects the single-trade cap
- daily volume cap is respected
- cooldown is respected
- vault is not paused
- `executionHash` matches the submitted calldata
- `intent.minAmountOut` is not weaker than the policy floor
- realized output respects `intent.minAmountOut`

## Policy semantics

### Base token

The vault still has a `baseToken`, and it is auto-allowlisted as an input token. But execution is no longer limited to `tokenIn == baseToken`.

That is an important upgrade because it allows:

- swap-based rebalancing
- token rotation
- more realistic controller behavior

### Token allowlists

- `allowedInputTokens[token]` controls what the vault can sell
- `allowedTokens[token]` controls what the vault can buy
- `allowedPairs[tokenIn][tokenOut]` is the final gate

The pair gate matters because it prevents a controller from combining two individually allowed tokens in an unwanted direction.

### `maxAmountPerTrade`

- measured in units of `tokenIn`
- blocks any single swap above the cap

### `maxDailyVolume`

- measured in units of `tokenIn`
- tracked with a UTC day bucket
- intentionally simple for the current product scope

### `cooldownSeconds`

- applied per vault
- once a delegated swap executes, the vault must wait before the next one

### Slippage policy

The vault derives a policy floor from the quote:

```text
policyMinAmountOut = quotedAmountOut * (10_000 - maxSlippageBps) / 10_000
```

Then it requires:

- `intent.minAmountOut >= policyMinAmountOut`
- realized `amountOut >= intent.minAmountOut`

This means the controller can choose a stricter bound than the vault policy, but not a weaker one.

## Adapter model

The vault is adapter-aware, not router-hardcoded.

Today:

- the backend supports one configured adapter
- the first adapter is `OkxAggregatorSwapAdapter`

Why this is better:

- venue choice becomes explicit policy
- the vault is ready for future swap venues
- the contract does not need arbitrary external calls

## Proposed methods

The current contract surface is conceptually:

- `deposit(...)`
- `withdraw(...)`
- `authorizeController(...)`
- `revokeController(...)`
- `addAllowedInputToken(...)`
- `removeAllowedInputToken(...)`
- `addAllowedToken(...)`
- `removeAllowedToken(...)`
- `allowPair(...)`
- `revokePair(...)`
- `allowSwapAdapter(...)`
- `revokeSwapAdapter(...)`
- `updatePolicy(...)`
- `pause()`
- `unpause()`
- `executeSwap(intent, executionData, signature, paymentRef, registry)`

## Why this exists instead of normal wallet delegation

Normal wallet delegation is simpler, but it usually creates broader power than we want.

With wallet delegation:

- the agent or delegate often gets broad approval scope
- a compromised controller can have too much reach
- there is less separation between strategy and execution

With the vault:

- capital is isolated
- permissions are explicit
- execution is policy-bounded
- the operator can be paid without owning strategy capital

## Product simplifications

The current vault intentionally stays narrow:

- swap execution only
- one operator address per vault
- explicit controller allowlist
- no arbitrary plugin execution
- no protocol-specific logic inside the vault

That narrowness is a feature, not a bug. It keeps the trust boundary legible.
