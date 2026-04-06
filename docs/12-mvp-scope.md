# 12. MVP Scope

## In scope
- one operator service
- one controller demo agent
- one vault contract
- one execution registry contract
- spot swaps on X Layer
- one concrete use case: single swap only
- `x402`-protected execution endpoint
- one lightweight console for vault policy and receipts

## Out of scope
- NLP or intent parsing
- a multi-controller permission system beyond a basic allowlist
- factory contract
- subscriptions or credit bundles
- `pay-with-any-token`
- insurance or claims
- a complex reputation system
- marketplace or discovery features
- broad consumer UX optimization

## Why the scope is intentionally narrow
Earlier versions of the idea risked becoming too large for the hackathon. The MVP is designed to prove one thing well: that safe delegated execution can exist as an infra primitive with policy enforcement, `x402` monetization, and public receipts.

## Default product choices
- primary customer: other agents / protocols
- primary use case: delegated spot-swap execution under policy constraints
- controller model: one authorized controller address per demo vault
- contracts: `OperatorVault.sol` and `ExecutionRegistry.sol`
- frontend: minimal console, not a marketing-heavy app
- canonical vault identifier: vault contract address

## First implementation slice
If time gets tight, the first implementation slice should still include:
- a funded vault
- one controller
- one signed execution intent
- one paid `x402` execution
- one onchain receipt

If any of those are missing, the core thesis is not proven yet.
