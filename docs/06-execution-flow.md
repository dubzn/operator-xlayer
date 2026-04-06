# 06. Execution Flow

## Why this flow matters
The flow is the heart of the product. If the team can implement this cleanly once, the project works. If the flow becomes fuzzy, the project collapses into a backend service with nice branding.

## Setup flow
The setup path happens once per vault.

1. **Owner initializes the vault**
   - The owner deploys or initializes the vault contract.
   - The owner sets the initial policy values.
   - The owner points the vault at the operator and registry.

2. **Owner funds the vault**
   - The owner deposits the strategy capital.
   - This capital is separate from any operator fee.

3. **Owner authorizes the operator**
   - The vault records which operator address can submit execution calls.

4. **Owner authorizes the controller agent**
   - The vault allowlists a controller address.
   - The controller is now allowed to sign execution intents for this vault.

5. **Owner inspects the starting state**
   - confirm balances
   - confirm policy values
   - confirm controller and operator addresses

## Preview flow
Preview is optional but useful.

1. Controller constructs a candidate request.
2. Controller calls `POST /preview`.
3. Operator runs route, market, and security checks.
4. Operator returns a deterministic preview with:
   - estimated route
   - estimated fee
   - policy check summary
   - warnings and expiry

Current default for MVP:
- preview is free
- preview is advisory only
- preview does not authorize execution by itself

## Paid execution flow
The runtime path happens every time the controller wants a real execution.

1. **Controller creates an `ExecutionIntent`**
   - The payload is deterministic and typed.
   - It includes vault ID, token pair, amount, slippage bound, nonce, and deadline.

2. **Controller signs the intent**
   - The signature proves the controller approved this exact action.

3. **Controller requests execution from the operator**
   - The controller sends the intent and the signature.
   - The controller pays the operator fee via `x402`.

4. **Operator validates the request**
   - verify payment
   - verify signature
   - verify controller allowlist status
   - verify nonce and deadline

5. **Operator fetches quote and checks**
   - use Onchain OS DEX for route and quote
   - use Onchain OS Market and Security for context if needed
   - abort if route is no longer compatible with policy

6. **Operator calls the vault**
   - the vault re-validates the policy conditions onchain
   - if valid, the vault executes
   - if invalid, the transaction reverts

7. **Registry stores the execution receipt**
   - record who requested the job
   - record which vault executed it
   - record the tx hash and relevant before/after execution facts
   - update basic track-record counters

## Concrete example
- `Vault #12`
- capital: `5000 USDT`
- owner policy:
  - allowed tokens: `USDT`, `ETH`, `OKB`
  - max per trade: `1000 USDT`
  - max daily volume: `3000 USDT`
  - max slippage: `200 bps`
  - cooldown: `1800 seconds`
- authorized controller: `TreasuryBot`
- authorized operator: `X402 Operator`

### Example request
`TreasuryBot` signs:
- `vaultId = 12`
- `tokenIn = USDT`
- `tokenOut = ETH`
- `amount = 800`
- `maxSlippageBps = 200`
- `nonce = 47`
- `deadline = <timestamp>`

Then:
- `TreasuryBot` pays the service fee through `x402`
- `X402 Operator` validates payment and intent
- the vault verifies the policy
- the swap executes if all checks pass
- the registry records the receipt

## What the receipt should make obvious
A useful receipt should answer:
- which vault was used
- which controller requested the action
- which operator executed it
- which payment funded the execution service
- which transaction actually ran onchain
- whether the outcome stayed inside expectations

## Separation of concerns
- **Preview** tells the caller what would likely happen.
- **Intent signature** proves the controller approved a specific action.
- **x402 payment** pays for the service.
- **Vault execution** decides whether the action is allowed.
- **Receipt recording** makes the outcome visible after the fact.

If any two of those blur together, the design gets weaker.
