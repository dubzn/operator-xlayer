# 00. Project Brief

## Project
- **Name:** `X402 Operator`
- **Hackathon context:** Build X Hackathon, X Layer Arena
- **Category:** infrastructure primitive for agentic execution
- **Current phase:** docs-first bootstrap, implementation not started

## One-line pitch
`X402 Operator` is a delegated execution layer for agents on X Layer: owners keep custody inside policy-constrained vaults, controller agents trigger typed actions, and the operator charges per execution through `x402` while leaving public onchain receipts.

## Differentiation
- **Primary differentiation:** delegated execution without surrendering custody
- **Anti-positioning:** not a trading bot, not a marketplace, not a generic paywalled API

## Primary buyer
- Other agents
- Protocols that need repeatable DeFi execution
- Treasury and portfolio systems that need automation without broad wallet delegation

## Secondary audience
- Hackathon judges
- Infra-minded builders
- Advanced DeFi operators who care about constrained automation

## Core value proposition
`X402 Operator` gives automated systems a way to execute onchain actions while preserving explicit owner control. Capital lives in a vault. Authority is scoped by policy. Execution requests must be signed by an authorized controller. The operator earns a fee via `x402` for each job it executes. The result is a system that is more autonomous than manual signing and safer than handing over a wallet key.

## Product principles
- **Infra-first:** the protocol matters more than the dashboard.
- **Typed, deterministic actions:** no natural language parsing in MVP.
- **Onchain enforcement over backend promises:** the vault is the final policy gate.
- **Transparent execution:** every successful job should generate a clear, inspectable receipt.
- **Minimal credible primitive:** ship the smallest slice that proves the thesis.

## Success criteria for the first implementation slice
- A new engineer can read the repo and understand the system without prior chat context.
- The MVP design clearly covers owner, controller, operator, vault, and execution registry.
- The payment model cleanly separates vault capital from the operator fee.
- The authorization model clearly requires allowlisted controllers plus signed intents.
- The first build slice is small enough to ship during the hackathon.
