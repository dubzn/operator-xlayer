# X402 Operator

> Delegated execution for agents on X Layer without surrendering custody.

**Status:** MVP functional on X Layer testnet (chain 1952). E2E swap flow verified. OKX DEX API integrated for mainnet.

## What is this

An infrastructure primitive for delegated DeFi execution on X Layer. A vault owner deposits funds into an onchain vault, configures policy guardrails, and authorizes a controller agent. The controller decides when to act, signs an `ExecutionIntent`, pays the operator's fee via `x402`, and the operator executes only if the vault policy allows it.

## Architecture

```
┌──────────────┐   signs intent    ┌──────────────┐   submits tx    ┌──────────────┐
│  Controller   │ ────────────────▶ │   Operator    │ ──────────────▶│    Vault      │
│  (AI Agent)   │   pays fee (402)  │   (Backend)   │   routeData    │  (Onchain)    │
└──────────────┘                    └──────────────┘                 └──────────────┘
                                                                          │
                                                                          ▼
                                                                    ┌──────────────┐
                                                                    │   Registry    │
                                                                    │  (Receipts)   │
                                                                    └──────────────┘
```

- **Vault Owner** — configures rules, deposits capital, authorizes controllers via the frontend
- **Controller Agent** — signs typed execution intents (EIP-712)
- **Operator Backend** — charges per request via x402, validates, submits transactions
- **OperatorVault** — holds funds, enforces 13 onchain policy checks
- **VaultFactory** — lets users deploy vaults from the frontend, auto-registers in registry
- **ExecutionRegistry** — stores receipts and track-record counters
- **MockRouter** — testnet swap simulator
- **OKX DEX Aggregator** — production swap routing via OKX DEX API v6

## Packages

| Package | Description |
|---|---|
| `packages/contracts` | Solidity contracts (Foundry) — Vault, Factory, Registry, MockRouter |
| `packages/shared` | TypeScript types and EIP-712 utilities |
| `packages/backend` | Express server — x402 payment flow, intent validation, execution |
| `packages/agent` | Autonomous trading bot — loop with preview, x402 payment, execution |
| `packages/frontend` | React dashboard — create vaults, configure policy, monitor, history |

## Quick start

### Prerequisites

- Node.js 20+
- [Foundry](https://book.getfoundry.sh/) (for contracts)
- MetaMask (for frontend)

### Build and run

```bash
# Install and build
npm install
npm run build

# Contracts
cd packages/contracts
forge build

# Backend (terminal 1)
cd packages/backend
npm run dev

# Agent (terminal 2) — runs one swap cycle
cd packages/agent
npm start

# Frontend (terminal 3)
cd packages/frontend
npm install
npm run dev
```

The `.env` files for backend and agent are pre-configured for X Layer testnet.

### Testnet info

See [docs/testnet-deployment.md](docs/testnet-deployment.md) for network config, faucet, deployed contract addresses, and e2e test results.

## Core flow

1. Owner creates a vault via the frontend (calls `VaultFactory.createVault()`)
2. Owner configures policy (max trade, daily volume, slippage, cooldown) and authorizes a controller
3. Controller agent signs an `ExecutionIntent` (EIP-712) and calls `POST /execute`
4. Backend returns `402` with fee challenge
5. Controller pays fee (ERC20 transfer) and re-submits with `paymentReference`
6. Backend validates payment + intent, gets swap route, calls `vault.executeSwap()`
7. Vault enforces all 13 policy checks onchain and executes the swap
8. Registry records receipt and updates operator track record

## Key documents

- [Architecture & Flow](docs/architecture.md) — complete system architecture, x402 protocol, security model
- [Testnet Deployment](docs/testnet-deployment.md) — network config, faucet, deployed addresses
- [Handoff](HANDOFF.md) — detailed implementation status and what's next
