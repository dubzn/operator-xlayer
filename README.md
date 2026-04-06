# X402 Operator

> Delegated execution for agents on X Layer without surrendering custody.

**Status:** Phase 1 — vertical slice implementation

## Prerequisites

- [Foundry](https://book.getfoundry.sh/) — forge v1.4.1 (`forge Version: 1.4.1-v1.4.1`)
- Solidity 0.8.24

## Why this matters
Agents are good at deciding when to act, but repeated onchain execution creates a bad tradeoff today: either the owner hands over too much wallet power, or the owner has to sign every transaction manually. `X402 Operator` is designed to remove that tradeoff. It lets an owner lock capital inside a policy-constrained vault, authorize a controller agent, and let an operator execute approved actions while charging per request through `x402`.

## What X402 Operator is
`X402 Operator` is an infrastructure primitive for delegated DeFi execution on X Layer. A vault owner deposits funds into an onchain vault, configures policy guardrails, and authorizes an operator plus one or more controller agents. A controller agent decides when an action should happen, signs an `ExecutionIntent`, pays the operator's execution fee via `x402`, and the operator executes only if the vault policy allows it. Every paid execution produces a public execution receipt and updates a simple onchain track record.

This is **not** a trading bot, a marketplace, or a generic paywalled API. It is an execution layer that other agents and protocols can consume.

## Core loop
1. A vault owner creates or initializes a vault and deposits capital.
2. The owner defines policy guardrails and authorizes an operator and controller agent.
3. A controller agent requests an action by signing an `ExecutionIntent` bound to the vault address.
4. The operator performs free pre-validation, then the controller pays the operator's service fee via `x402`.
5. The operator validates the payment and the intent, fetches quotes and checks, and calls the vault.
6. The vault enforces policy constraints onchain and executes only valid operations.
7. The registry records an execution receipt and updates the operator track record.

## Architecture at a glance
- **Vault owner** configures rules and owns the capital.
- **Controller agent** decides when to act and signs typed execution intents.
- **Operator service** charges per request via `x402`, validates intents, and submits transactions.
- **Operator vault** holds funds and enforces the owner-defined policy.
- **Execution registry** stores public receipts and track-record counters.
- **Onchain OS** provides wallet identity plus trade, market, and security data.
- **X Layer mainnet** is the execution environment and source of public verifiability.

## Current repo purpose
This repository is the canonical source of truth for the project direction. Phase 1 is intentionally docs-first so the team can begin implementation without reconstructing earlier conversations or revisiting discarded ideas.

## Key documents
- [Project Brief](docs/00-project-brief.md)
- [Problem and Wedge](docs/01-problem-and-wedge.md)
- [Competitive Analysis](docs/02-competitive-analysis.md)
- [System Architecture](docs/03-system-architecture.md)
- [Actors and Trust Model](docs/04-actors-and-trust-model.md)
- [Vault Spec](docs/05-vault-spec.md)
- [Execution Flow](docs/06-execution-flow.md)
- [x402 Integration](docs/07-x402-integration.md)
- [Onchain OS Integration](docs/08-onchainos-integration.md)
- [Contract Plan](docs/09-contract-plan.md)
- [API and Types](docs/10-api-and-types.md)
- [Demo Story](docs/11-demo-story.md)
- [MVP Scope](docs/12-mvp-scope.md)
- [Build Plan](docs/13-build-plan.md)
- [Risks and Kill Criteria](docs/14-risks-and-kill-criteria.md)
- [Open Questions](docs/15-open-questions.md)
