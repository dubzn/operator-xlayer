# X402 Operator

> Secure swap execution for agents on X Layer without surrendering custody.

**Status:** Mainnet-first codebase for X Layer (chain 196). The current repo implements `swap-v2`: adapter-aware vault execution, OKX DEX routing, typed quote binding via `executionHash`, and `x402` payment for execution.

## What this is

X402 Operator is an infrastructure primitive for delegated onchain execution.

An owner deposits capital into an onchain vault, defines risk guardrails, and authorizes one or more controller addresses. A controller agent decides when to act, gets a preview from the operator, signs a typed `ExecutionIntent`, pays the operator fee via `x402`, and the operator executes only if the vault policy still allows the swap.

The product is not "create an AI bot here." The product is:

- keep capital in a vault
- let agents request execution
- force every execution through onchain policy
- meter the execution service with `x402`

## What exists today

The current implementation is intentionally narrow and strong:

- swap-only delegated execution
- adapter-ready vaults
- first adapter wired to the OKX DEX Aggregator
- pair-level allowlists (`tokenIn`, `tokenOut`, and `tokenIn -> tokenOut`)
- preview-driven quote binding with `executionHash`
- EIP-712 signed intents (`version = "2"`)
- onchain receipts and operator track record

This means the repo is already a better fit for:

- trader agents that rotate positions
- rebalancers
- portfolio rotation bots
- treasury automation for token swaps

It does **not** claim to be a universal protocol automation layer yet.

## Who brings the agent

The owner does not need to create an agent inside this product.

This repo ships a reference controller in `packages/agent`, but the authorized controller can be:

- the owner's own bot
- a third-party strategy agent
- a protocol integration
- the demo agent from this repo

What matters is:

- the vault owner authorizes the controller address
- the controller signs the typed intent
- the vault enforces the policy onchain

## Why the agent pays through x402

`x402` pays for the operator's execution service, not for access to the vault capital.

There are two separate money flows:

1. **Vault capital**
   - belongs to the vault owner
   - remains inside the vault
   - is constrained by onchain policy

2. **Operator fee**
   - is paid by the caller agent via `x402`
   - pays for preview, validation, routing, transaction submission, and execution
   - does not grant permission to move vault funds by itself

Authorization still comes from:

- the controller allowlist
- the EIP-712 signature
- the vault's onchain policy

## Architecture

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

- **Vault Owner** configures policy, deposits capital, and authorizes controllers
- **Controller Agent** requests swaps and signs the final intent
- **Operator Backend** previews, charges via `x402`, validates, and submits execution
- **OperatorVault** holds funds and enforces execution policy onchain
- **Swap Adapter** is the execution venue abstraction; today the backend supports the OKX adapter
- **ExecutionRegistry** stores receipts and simple operator track record

## Swap-v2 execution model

The current flow is:

1. Owner creates a vault and funds it
2. Owner configures:
   - controller allowlist
   - input token allowlist
   - output token allowlist
   - allowed pairs
   - allowed swap adapters
   - max per trade, daily volume, slippage, cooldown
3. Controller sends a draft preview request
4. Backend gets a quote from OKX DEX, computes `executionHash`, derives the policy floor for `minAmountOut`, and returns the preview
5. Controller signs the **final** `ExecutionIntent` containing:
   - adapter
   - amountIn
   - quotedAmountOut
   - minAmountOut
   - nonce
   - deadline
   - `executionHash`
6. Controller calls `POST /execute`
7. Backend returns HTTP `402`
8. Controller pays the fee and re-submits with `paymentReference`
9. Backend validates payment, cached quote, signature, and vault state
10. Backend calls `vault.executeSwap(...)`
11. Vault re-validates onchain and records a receipt

## What the vault enforces onchain

Every delegated swap still goes through hard checks in the vault:

- vault not paused
- vault address matches the intent
- selected adapter is allowlisted
- recovered signer matches `intent.controller`
- controller is authorized
- nonce is unused
- deadline has not expired
- input token is allowlisted
- output token is allowlisted
- pair is allowlisted
- amount is within per-trade cap
- daily volume cap is respected
- cooldown has elapsed
- `executionHash` matches the exact calldata used for execution
- `intent.minAmountOut` is not weaker than the vault policy floor
- realized `amountOut` is at least `intent.minAmountOut`

That is the key trust boundary in the system.

## What the operator adds beyond OKX

OKX gives routing and best-execution style calldata. X402 Operator adds:

- custody separation
- controller authorization
- pair-level policy enforcement
- typed quote binding with `executionHash`
- `x402` metering for execution-as-a-service
- receipts and track record

That is why the system is more than "just a DEX wrapper" or "just a relayer."

## Packages

| Package | Description |
|---|---|
| `packages/contracts` | Solidity contracts: vault, factory, adapter, registry |
| `packages/shared` | Shared types and EIP-712 helpers |
| `packages/backend` | Express operator service: preview, execute, x402, validation |
| `packages/agent` | Reference controller agent |
| `packages/frontend` | React dashboard for vault creation and monitoring |

## Quick start

### Prerequisites

- Node.js 20+
- [Foundry](https://book.getfoundry.sh/)
- MetaMask

### Build and run

```bash
npm install
npm run build
npm run typecheck

cd packages/contracts
forge build
forge test

cd /path/to/repo/packages/backend
npm run dev

cd /path/to/repo/packages/agent
npm start

cd /path/to/repo/packages/frontend
npm install
npm run dev
```

The backend and agent `.env.example` files are aligned to the current mainnet-first flow and include:

- `SWAP_ADAPTER_ADDRESS`
- OKX API credentials
- optional `OKX_DEX_IDS` / `OKX_EXCLUDE_DEX_IDS`

## Mainnet deployment

See [docs/mainnet-deployment.md](docs/mainnet-deployment.md) for network constants, the current deploy script shape, and notes about refreshing addresses after deploying the `swap-v2` contracts.

## FAQ

### Does the user create their own agent?

Not necessarily. The user authorizes a controller address. That controller can be their own bot, a third-party agent, a protocol integration, or the demo agent included in this repo.

### Is x402 paying for access to the vault?

No. `x402` pays the operator for execution-as-a-service. The capital remains in the vault and can only move if the signed request also passes the vault policy.

### Is this just an OKX wrapper?

No. OKX supplies routing. X402 Operator adds the custody boundary, controller authorization, pair-level guardrails, typed quote binding, `x402` fee flow, and onchain receipts.

## Key documents

- [Architecture & Flow](docs/architecture.md)
- [API and Types](docs/10-api-and-types.md)
- [Vault Spec](docs/05-vault-spec.md)
- [Detailed Execution Flow](docs/16-detailed-execution-flow.md)
- [Mainnet Deployment](docs/mainnet-deployment.md)
- [Handoff](HANDOFF.md)
