# X402 Operator - X Layer

> The secure execution rail for agents on X Layer.

X402 Operator is our Build X Hackathon submission for the X Layer Arena.

The wedge is simple: agents should be able to execute real swaps without receiving broad wallet custody. We solve that by separating four roles:

- the owner keeps capital in an onchain vault
- the owner defines policy guardrails
- a controller agent decides when to act
- the operator sells execution as a paid API via `x402`

Every successful execution leaves an onchain receipt.

## The real problem

Most agent demos stop at decision-making.

The hard part begins when an agent needs to touch real capital repeatedly:

- if you give the agent a private key or broad wallet delegation, execution is powerful but dangerous
- if the owner signs every action manually, execution is safer but no longer autonomous

We build the third option:

- capital stays in a vault
- authority stays bounded by policy
- the controller signs a typed intent
- the operator gets paid for execution-as-a-service
- the vault re-validates everything onchain before capital can move

## What is live today

The current repo already implements a narrow but credible `swap-v2` slice:

- delegated spot-swap execution
- `VaultFactory`, `OperatorVault`, `OkxAggregatorSwapAdapter`, and `ExecutionRegistry`
- policy controls for controllers, input tokens, output tokens, pairs, adapters, per-trade caps, daily volume, slippage, and cooldown
- preview-driven quote binding through `executionHash`
- EIP-712 intents with `version = "2"`
- `x402` payment gating on `POST /execute`
- onchain receipts plus operator success count
- a reference controller agent in `packages/agent`
- a frontend console and in-app documentation in `packages/frontend`

## What we are intentionally not claiming

This is not yet:

- a universal execution primitive for every DeFi action
- an open marketplace of many operators
- a full reputation economy
- a consumer trading app
- a bot builder where users create strategies inside the product

That restraint is a feature. It keeps the story honest and the demo sharp.

## Who this is for

The first natural users are:

- trader agents that already know when to rotate
- rebalancers
- portfolio rotators
- treasury automation systems
- protocol integrations that need repeatable swap execution
- multi-agent systems where one agent decides and another pays

It is not meant for casual manual one-off swaps.

## System in one minute

```text
┌──────────────┐   preview + sign   ┌──────────────┐   executeSwap   ┌──────────────┐
│ Controller   │ ─────────────────▶ │   Operator   │ ──────────────▶ │ OperatorVault │
│   Agent      │   pays fee (402)   │   Backend    │   via adapter   │   (onchain)   │
└──────────────┘                    └──────────────┘                  └──────────────┘
        │                                     │                               │
        │                                     │                               ▼
        │                                     │                        ┌──────────────┐
        │                                     └──── OKX DEX quote ───▶ │ Execution    │
        │                                                              │ Registry     │
        └──────────── preview / execute API ◀───────────────────────────└──────────────┘
```

Roles:

- **Vault owner:** deposits capital, defines policy, authorizes controllers
- **Controller agent:** requests preview, signs the final intent, pays the operator fee
- **Operator backend:** quotes, validates, enforces `x402`, and submits execution
- **OperatorVault:** the hard trust boundary; capital only moves if policy allows it
- **Swap adapter:** venue abstraction; today the backend supports the OKX adapter
- **ExecutionRegistry:** public receipt ledger plus simple operator track record

## End-to-end execution flow

1. The owner creates a vault and funds it.
2. The owner configures controllers, token allowlists, pair allowlists, adapter allowlists, and risk limits.
3. The controller sends a draft `POST /preview` request.
4. The backend reads live vault state, asks OKX DEX for a route, computes `executionHash`, derives a policy-safe `minAmountOut`, and returns the final signable package.
5. The controller signs the final EIP-712 `ExecutionIntent`.
6. The controller calls `POST /execute`.
7. If there is no payment yet, the backend returns HTTP `402`.
8. The controller pays the fee and retries with `paymentReference`.
9. The backend validates payment, signature, cached quote, and current vault state.
10. The backend calls `vault.executeSwap(...)`.
11. The vault re-validates onchain and writes a receipt through `ExecutionRegistry`.

## Why `executionHash` matters

The controller is not signing a vague instruction like "swap into safety."

The controller signs the exact execution package:

- vault address
- controller address
- adapter
- token pair
- amount
- quote-derived output bounds
- nonce
- deadline
- `executionHash`

That gives the system a tight binding between preview and execution without forcing the controller to parse router calldata directly.

## What the vault enforces onchain

Every delegated swap still goes through hard checks:

- vault not paused
- `intent.vaultAddress` matches the vault contract
- selected adapter is allowlisted
- recovered signer matches `intent.controller`
- controller is currently authorized
- nonce is unused
- deadline has not expired
- `tokenIn` is allowlisted
- `tokenOut` is allowlisted
- `tokenIn -> tokenOut` pair is allowlisted
- `amountIn` fits the single-trade cap
- daily volume cap is respected
- cooldown has elapsed
- `keccak256(executionData) == intent.executionHash`
- `intent.minAmountOut` is not weaker than the policy floor derived from `quotedAmountOut`
- realized `amountOut` still satisfies `intent.minAmountOut`

This is the core claim of the project: the operator is useful, but the operator is not a broad custodian.

## Why `x402` belongs here

`x402` is not decorative.

There are two different money flows in the system:

1. **Vault capital**
   - belongs to the owner
   - remains inside the vault
   - is only touched by successful swap execution if policy allows it

2. **Operator fee**
   - is paid by the caller agent
   - pays for execution-as-a-service
   - covers validation, routing, packaging, and submission
   - does not grant permission to move vault capital

That clean separation is one of the strongest parts of the demo.

## Why this is more than OKX routing

OKX provides route discovery and calldata.

X402 Operator adds:

- custody separation
- controller authorization
- pair-level execution policy
- typed quote binding
- `x402` monetization
- public receipts and operator track record

That is why the product is not "just an OKX wrapper" and not "just a relayer."

## Suggested demo flow

Recommended demo runtime: `90–120 seconds`.

Suggested structure:

1. **Show the problem**
   Explain the tradeoff between wallet delegation and manual signing.

2. **Show the vault**
   Open the frontend, show a funded vault, show the policy fields, show the authorized controller and operator.

3. **Show preview**
   Display the exact `ExecutionIntent` fields and the preview response, including `expectedOut`, `minAmountOut`, and `executionHash`.

4. **Show `x402`**
   Trigger `POST /execute`, surface the `402 Payment Required` step, and show the fee payment.

5. **Show enforcement**
   Show the backend attempting execution and explain that the vault still re-validates everything onchain.

6. **Show the receipt**
   Show the tx hash, receipt, and operator track record update.

Closing line:

> The ecosystem is building agent brains. We build the execution rail they can trust with capital.

## Mainnet reference

### Network

| Field | Value |
|---|---|
| Network | X Layer Mainnet |
| Chain ID | `196` |
| RPC URL | `https://rpc.xlayer.tech` |
| Native currency | `OKB` |
| Explorer | `https://www.okx.com/explorer/xlayer` |

### Live operator backend

| Field | Value |
|---|---|
| Base URL | `https://operator-xlayer.onrender.com` |
| Preview | `https://operator-xlayer.onrender.com/preview` |
| Execute | `https://operator-xlayer.onrender.com/execute` |
| Receipts | `https://operator-xlayer.onrender.com/receipts/:jobId` |
| Track record | `https://operator-xlayer.onrender.com/operator/track-record` |

### Current frontend reference addresses

These are the addresses currently wired into `packages/frontend/src/config/contracts.ts`:

| Item | Address |
|---|---|
| VaultFactory | `0x9b9453B159E67563ae4656841CB53F71fD64B557` |
| ExecutionRegistry | `0xa4D8B6764743dFf59bB7b71119d44aC19F0e2235` |
| OKX Swap Adapter | `0x60cA56681bEa06fE72A73B18Ca62D766B040f7E1` |
| Reference Vault | `0x749f9bE6366373A85fD6130927fDc90Eb7862bED` |
| Operator | `0xf88A50EF4CFCaa82021D6B362530Bc0887CB570B` |
| OKX Router | `0xD1b8997AaC08c619d40Be2e4284c9C72cAB33954` |
| OKX Approval Target | `0x8b773D83bc66Be128c60e07E17C8901f7a64F000` |
| USDT | `0x1E4a5963aBFD975d8c9021ce480b42188849D41d` |
| USDC | `0x74b7F16337b8972027F6196A17a631aC6dE26d22` |

### Reference demo policy

The current frontend and deployment flow are optimized for a crisp first demo:

- base token: `USDT`
- allowed output token: `USDC`
- allowed pair: `USDT -> USDC`
- default swap adapter: OKX
- one shared operator
- one initial authorized controller

## API surface

### Endpoints

Production base URL: `https://operator-xlayer.onrender.com`

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/preview` | Build the signable execution package and run free preflight checks |
| `POST` | `/execute` | Enforce `x402`, validate the final payload, and submit execution |
| `GET` | `/receipts/:jobId` | Fetch the public receipt from `ExecutionRegistry` |
| `GET` | `/operator/track-record` | Return the current onchain success counter |

The backend is now multi-vault: it resolves the target vault from `intent.vaultAddress` on every request. A vault is executable only if it authorizes this operator backend, is registered in the shared `ExecutionRegistry`, and uses the operator's configured swap adapter.

### ExecutionIntent

```ts
type ExecutionIntent = {
  vaultAddress: string
  controller: string
  adapter: string
  tokenIn: string
  tokenOut: string
  amountIn: string
  quotedAmountOut: string
  minAmountOut: string
  nonce: number
  deadline: number
  executionHash: string
}
```

### Canonical formulas

```text
policyMinAmountOut = quotedAmountOut * (10_000 - maxSlippageBps) / 10_000
jobId = keccak256(intentHash, paymentReference)
```

### Quote source

The backend supports two modes:

- **Mainnet mode:** real OKX DEX API routing
- **Local/dev mode:** mock router routeData for testing

If preview returns `route-not-ready` or `quote-missing`, the backend is telling you the current preview is informational and not yet executable.

## Repo map

| Path | Purpose |
|---|---|
| `packages/contracts` | Solidity contracts for vault, factory, adapter, and registry |
| `packages/shared` | Shared types, hashing, and EIP-712 helpers |
| `packages/backend` | Operator API for preview, execute, payment validation, and onchain submission |
| `packages/agent` | Reference controller agent that signs intents and pays fees |
| `packages/frontend` | Vault console plus in-app documentation |
| `HANDOFF.md` | Current implementation notes and operational handoff |

## Running locally

### Requirements

- Node.js `20+`
- [Foundry](https://book.getfoundry.sh/)
- MetaMask

### Install and checks

```bash
npm install
npm run build
npm run typecheck

cd packages/contracts
forge build
forge test
```

### Backend

Use `packages/backend/.env.example` as the baseline.

Important fields:

- `RPC_URL`
- `CHAIN_ID`
- `REGISTRY_ADDRESS`
- `FACTORY_ADDRESS`
- `SWAP_ADAPTER_ADDRESS`
- `DEFAULT_WATCH_VAULTS` (optional)
- `OPERATOR_PRIVATE_KEY`
- `OPERATOR_FEE`
- `FEE_TOKEN`
- `USE_MOCK_ROUTER`
- OKX API credentials when `USE_MOCK_ROUTER=false`

Run:

```bash
cd packages/backend
npm run dev
```

### Agent

Use `packages/agent/.env.example` as the baseline.

Important fields:

- `CONTROLLER_PRIVATE_KEY`
- `OPERATOR_URL` (`https://operator-xlayer.onrender.com` for the live mainnet backend)
- `VAULT_ADDRESS` or `VAULT_ADDRESSES`
- `SWAP_ADAPTER_ADDRESS`
- `TOKEN_IN`
- `TOKEN_OUT`
- `FEE_TOKEN`
- `AUTO_WATCH_VAULTS` (optional)

Run:

```bash
cd packages/agent
npm start
```

For multi-vault end-to-end tests, set `VAULT_ADDRESSES` as a comma-separated list. The agent will run one pass over every configured vault in each round and can optionally register them in the backend indexer before execution.

### Frontend

```bash
cd packages/frontend
npm install
npm run dev
```

Open the in-app documentation at `/docs`.

## FAQ

### Is this just a relayer?

No. A relayer forwards transactions. X402 Operator adds custody separation, typed intents, onchain policy, quote binding, `x402` monetization, and public receipts.

### Is this centralized because there is a backend?

There is an offchain operator service, and we are explicit about that. But the important security boundary is onchain: even a malicious operator still cannot bypass the vault policy and withdraw funds arbitrarily.

### Why not just use session keys?

Session keys help, but they do not by themselves create the same separation between strategy, execution, custody, and audit trail. The vault makes the guardrails explicit and inspectable.

### What happens if the controller is compromised?

The owner pauses the vault, revokes the controller, and updates policy. The blast radius is smaller than broad wallet delegation because the controller is still constrained by token, pair, amount, slippage, volume, and cooldown policy.

### What happens if execution fails after payment?

In the current MVP, the fee pays for the execution attempt, not a guaranteed fill. That is why preview and pre-validation happen before the `402` challenge.

### Does the user need to build an agent inside this product?

No. The owner only needs to authorize a controller address. That controller can be the repo's demo agent, a private bot, a third-party strategy agent, or a protocol integration.

## Final positioning

The strongest honest framing for this repo is:

- **today:** secure delegated swap execution for agents on X Layer
- **next:** more swap venues and richer adapters
- **later:** protocol-specific actions such as LP, lending, or staking

We are not trying to win by being another trading bot.

We are trying to win by building the execution rail that agentic products can trust with capital.
