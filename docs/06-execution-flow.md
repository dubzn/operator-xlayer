# 06. Execution Flow

## Why this flow matters

The flow is the product. If the flow is crisp, the system is trustworthy. If the flow gets fuzzy, the project degrades into a backend service with a nice story.

## Setup flow

The setup path happens once per vault.

1. **Owner creates the vault**
   - deploy directly or via factory
   - set operator and default adapter through the factory path

2. **Owner funds the vault**
   - deposit strategy capital
   - fee funding remains separate from vault capital

3. **Owner configures policy**
   - authorize controllers
   - allow input tokens
   - allow output tokens
   - allow pairs
   - allow swap adapters
   - set max per trade, daily volume, slippage, cooldown

4. **Owner inspects the initial state**
   - balances
   - controllers
   - token and pair policy
   - adapter policy

## Preview flow

Preview is now part of the core execution path, not just a nicety.

1. Controller constructs a draft request
   - `vaultAddress`
   - `controller`
   - `adapter`
   - `tokenIn`
   - `tokenOut`
   - `amountIn`
   - placeholder quote fields

2. Controller calls `POST /preview`

3. Operator:
   - reads vault state
   - fetches a quote from OKX DEX
   - derives the policy floor for `minAmountOut`
   - computes `executionHash`
   - caches the route under that hash

4. Operator returns:
   - estimated fee
   - routed adapter and router info
   - `expectedOut`
   - `minAmountOut`
   - `executionHash`
   - risk flags and warnings
   - expiry

5. Controller uses the preview response to build the final intent

## Paid execution flow

This is the runtime path every time the controller wants a real swap.

1. **Controller signs the final `ExecutionIntent`**
   - includes adapter, quote values, and `executionHash`

2. **Controller requests execution**
   - sends `{intent, signature}`

3. **Operator enforces payment**
   - if unpaid, return HTTP `402`
   - controller pays the fee
   - controller retries with `paymentReference`

4. **Operator validates the request**
   - cached quote exists for `executionHash`
   - cached quote is not expired
   - adapter matches
   - quoted output matches
   - `minAmountOut` is not below the cached policy floor
   - signature is valid
   - controller is authorized
   - vault state still allows the swap

5. **Operator calls the vault**
   - passes the cached `executionData`
   - pays gas for `executeSwap(...)`

6. **Vault re-validates everything onchain**
   - if valid, execute
   - if invalid, revert

7. **Registry stores the receipt**
   - records the execution outcome
   - updates operator track record

## Concrete example

- vault capital: `5000 USDT`
- allowed inputs: `USDT`, `USDC`
- allowed outputs: `USDT`, `USDC`
- allowed pair: `USDT -> USDC`
- allowed adapter: OKX swap adapter
- max per trade: `1000 USDT`
- max daily volume: `3000 USDT`
- max slippage: `200 bps`
- cooldown: `1800 seconds`
- authorized controller: `TreasuryBot`

### Example path

1. `TreasuryBot` asks for a preview of `USDT -> USDC` for `800`
2. Backend returns:
   - `expectedOut`
   - policy-safe `minAmountOut`
   - `executionHash`
3. `TreasuryBot` signs the final intent
4. Backend returns `402`
5. `TreasuryBot` pays the fee
6. Backend validates payment and cached quote
7. Vault executes if all checks still pass
8. Registry records the receipt

## What the receipt should make obvious

A useful receipt should answer:

- which vault executed
- which controller requested it
- which operator executed it
- which adapter was used
- which payment funded the execution service
- what assets moved
- whether the swap succeeded

## What happens if execution fails after payment

The current semantics stay simple:

- the fee pays for the operator's execution attempt
- a reverted onchain execution does not auto-refund the fee
- this is why preview and offchain validation happen before the 402 challenge

## Separation of concerns

- **Preview** packages the quote the controller can sign
- **Signature** proves the controller approved the final swap bounds
- **x402 payment** pays for the service
- **Vault execution** decides whether the action is allowed
- **Receipt recording** makes the result visible

If those layers blur together, the design gets weaker.
