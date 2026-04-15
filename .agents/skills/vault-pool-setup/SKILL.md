---
name: vault-pool-setup
description: Use when the user wants to create a pool or vault that an agent can use in Operator XLayer. Also use when they ask whether the current operator API is enough, whether Vault needs its own API, how to create a vault for an agent, how to authorize a controller, or whether they need a dedicated backend for single-vault versus multi-vault setups.
---

# Vault Pool Setup

In this repo, many users will say "pool" when they really mean a policy-bound execution vault. This skill helps Codex map that request to the current architecture and answer with the right implementation path.

## First classify the request

- If the user means an LP/AMM pool, concentrated liquidity, fee tiers, or adding liquidity, stop and say this repo does not implement that flow.
- If the user means "a place where capital lives and an agent can trade from it with limits", treat that as an `OperatorVault`.

Default to `vault` unless the user explicitly describes liquidity provisioning.

## What the system supports today

- Vault creation is onchain through `VaultFactory.createVault(...)`.
- Vault policy is configured directly on the vault contract by the owner.
- The agent uses the operator backend for `POST /preview` and `POST /execute`.
- The current backend is effectively single-vault and single-adapter per deployment.

Key source files:

- `packages/contracts/src/VaultFactory.sol`
- `packages/contracts/src/OperatorVault.sol`
- `packages/backend/src/config.ts`
- `packages/backend/src/routes/execute.ts`
- `packages/frontend/src/components/CreateVault.tsx`
- `packages/agent/src/run.ts`

## The answer to "does our API already suffice?"

Use this decision rule:

- **Yes, the current API is enough** if the user wants one dedicated vault wired to one operator backend deployment, or is fine reconfiguring/redeploying the backend per vault.
- **No, the current API is not enough** if they want a self-serve or multi-vault product where many user vaults should work against the same backend without changing env vars.

Important nuance:

- The vault itself does **not** require its own API to exist or to hold funds. It is an onchain contract.
- An API is only needed for offchain services: quote building, `x402` charging, intent validation, cached execution payloads, and submission.

## Why the current API is not multi-vault yet

When explaining the limitation, mention these facts:

- `packages/backend/src/config.ts` loads a single `VAULT_ADDRESS`.
- `packages/backend/src/routes/execute.ts` rejects previews whose `intent.vaultAddress` does not match that configured vault.
- The reference agent in `packages/agent/src/run.ts` also assumes one `VAULT_ADDRESS` and one `SWAP_ADAPTER_ADDRESS`.

Do not claim that the current backend can serve arbitrary vaults without changes.

## Step-by-step workflow

When the user wants "create a pool and let the agent use it", follow this order.

### 1. Align on the primitive

Explain briefly:

- "In this repo the supported primitive is a vault, not an LP pool."
- "If by pool you mean delegated swap capital with guardrails, we should create a vault."

### 2. Create the vault onchain

Use one of these paths:

- Frontend path: `packages/frontend/src/components/CreateVault.tsx`
- Direct contract path: call `VaultFactory.createVault(baseToken, maxAmountPerTrade, maxDailyVolume, maxSlippageBps, cooldownSeconds)`

Important details:

- The factory auto-registers the new vault in `ExecutionRegistry`.
- The factory injects the shared operator and default swap adapter into the new vault.
- The emitted event is `VaultCreated(owner, vault, baseToken)`.

### 3. Persist the new vault address

After creation:

- read the `VaultCreated` event or
- call `getVaultsByOwner(owner)` and take the newest vault

The response to the user should always surface the final vault address.

### 4. Configure the vault for the agent

Call the owner-only vault methods as needed:

- `authorizeController(controller)`
- `addAllowedInputToken(tokenIn)` if input is not already allowed
- `addAllowedToken(tokenOut)`
- `allowPair(tokenIn, tokenOut)`
- `allowSwapAdapter(adapter)` if the desired adapter is not already allowed
- `updatePolicy(maxAmountPerTrade, maxDailyVolume, maxSlippageBps, cooldownSeconds)`

Explain the defaults correctly:

- the constructor allowlists the `baseToken` as input
- the constructor can allowlist the default swap adapter
- output tokens and exact pairs still need to be configured for the intended strategy

### 5. Fund the vault

Have the owner:

- approve the token to the vault if needed
- call `deposit(token, amount)`

Do not tell the user the agent should custody the funds directly.

### 6. Choose the API topology

Present only these two supported patterns.

**Pattern A: reuse the current API**

Use this when:

- one backend deployment is dedicated to one vault
- or the team is okay updating env vars per vault

What to configure:

- `VAULT_ADDRESS`
- `REGISTRY_ADDRESS`
- `SWAP_ADAPTER_ADDRESS`
- `RPC_URL`
- `OPERATOR_PRIVATE_KEY`
- `OPERATOR_FEE`
- `FEE_TOKEN`

Outcome:

- the existing `/preview` and `/execute` flow is enough
- no extra "vault API" is required

**Pattern B: deploy or refactor the backend for multi-vault**

Use this when:

- many user vaults should work from the same operator service
- the product is self-serve
- the backend should route by `intent.vaultAddress` instead of a singleton env var

Required backend changes:

- remove the hard equality check against a single configured `VAULT_ADDRESS`
- read policy and registry dynamically per `intent.vaultAddress`
- cache quotes per vault plus `executionHash`
- decide whether fees, adapters, and operator wallet are global or per vault
- update indexing and health endpoints so they are not single-vault only

Outcome:

- here it does make sense to deploy a dedicated API service or upgrade the current one into a multi-tenant operator API

### 7. Configure the agent

For the reference agent in `packages/agent/src/run.ts`, set:

- `OPERATOR_URL`
- `CONTROLLER_PRIVATE_KEY`
- `VAULT_ADDRESS`
- `SWAP_ADAPTER_ADDRESS`
- `TOKEN_IN`
- `TOKEN_OUT`
- `FEE_TOKEN`
- `RPC_URL`
- `SWAP_AMOUNT`

If the backend is still single-vault, the agent `VAULT_ADDRESS` must match the backend deployment.

### 8. Run the smoke test

Use the exact product flow:

1. draft intent
2. `POST /preview`
3. copy `expectedOut`, `minAmountOut`, and `executionHash`
4. sign the final EIP-712 intent
5. `POST /execute`
6. handle `402 Payment Required`
7. retry with `paymentReference`
8. verify tx hash and receipt

### 9. Give the architectural verdict clearly

When the user asks whether they need another API, answer in one of these two ways:

- "Con la API actual alcanza, pero solo si este vault va a vivir atado a un backend dedicado."
- "Para un flujo multi-vault o self-serve, el vault no necesita una API propia, pero sí necesitan desplegar o refactorizar el operator backend para que deje de estar fijado a un solo `VAULT_ADDRESS`."

## Preferred response shape

When using this skill, answer in this order:

1. State whether "pool" should be treated as `vault`.
2. State whether the current API is enough or not for the requested topology.
3. Give the concrete step-by-step.
4. Call out the backend single-vault limitation if relevant.
5. Recommend the smallest viable path first.

## Guardrails

- Never say the vault requires an API to be created.
- Never say the current backend is already multi-vault.
- Never suggest giving the agent broad wallet custody when a vault-based flow fits.
- If the user wants the fastest MVP, recommend: create vault onchain, configure policy, fund it, point one backend deployment to that vault, then run the agent.
