# X Layer Mainnet — Deployment and Config

## Network constants

| Field | Value |
|---|---|
| Network Name | X Layer Mainnet |
| RPC URL | `https://rpc.xlayer.tech` |
| Chain ID | `196` |
| Currency Symbol | `OKB` |
| Block Explorer | `https://www.okx.com/explorer/xlayer` |

## Core mainnet addresses

These are protocol constants used by the current deploy script:

| Item | Address |
|---|---|
| USDT | `0x1E4a5963aBFD975d8c9021ce480b42188849D41d` |
| USDC | `0x74b7F16337b8972027F6196A17a631aC6dE26d22` |
| OKX DEX Router | `0xD1b8997AaC08c619d40Be2e4284c9C72cAB33954` |
| OKX Approval Target | `0x8b773D83bc66Be128c60e07E17C8901f7a64F000` |

## Current `swap-v2` deploy shape

The current repo deploys these contracts in mainnet mode:

1. `ExecutionRegistry`
2. `OkxAggregatorSwapAdapter`
3. `VaultFactory`
4. an initial `OperatorVault` created through the factory

The mainnet script also configures an initial policy:

- base token = USDT
- allowed output token = USDC
- allowed pair = `USDT -> USDC`
- default swap adapter = OKX adapter
- operator = deployer
- one initial authorized controller = deployer

Reference script:

- [packages/contracts/script/DeployMainnet.s.sol](/Users/damianalejandropinones/Documents/temp/agentic/operator-xlayer/packages/contracts/script/DeployMainnet.s.sol)

## Important note about addresses

The repo still contains a previous mainnet broadcast artifact from the older router-pinned vault design.

Treat those broadcasted addresses as **legacy reference only** if you are using the current `swap-v2` contracts, backend, and agent. The new adapter-aware flow should be deployed again so that:

- the vault ABI matches the backend and shared types
- `SWAP_ADAPTER_ADDRESS` is real
- receipts include `adapter`
- preview and execute run against the current intent shape

## Backend and agent config

The current mainnet path expects these values:

- `RPC_URL=https://rpc.xlayer.tech`
- `CHAIN_ID=196`
- `VAULT_ADDRESS`
- `REGISTRY_ADDRESS`
- `SWAP_ADAPTER_ADDRESS`
- `OPERATOR_PRIVATE_KEY`
- `FEE_TOKEN`
- `OPERATOR_FEE`
- OKX API credentials

Use these files as the current baseline:

- [packages/backend/.env.example](/Users/damianalejandropinones/Documents/temp/agentic/operator-xlayer/packages/backend/.env.example)
- [packages/agent/.env.example](/Users/damianalejandropinones/Documents/temp/agentic/operator-xlayer/packages/agent/.env.example)

## Frontend note

The frontend already points to X Layer mainnet, but after a fresh `swap-v2` deployment you should update:

- contract addresses
- any ABI fragments that still reflect the older vault shape

Reference file:

- [packages/frontend/src/config/contracts.ts](/Users/damianalejandropinones/Documents/temp/agentic/operator-xlayer/packages/frontend/src/config/contracts.ts)

## Deploy command

```bash
cd packages/contracts
forge script script/DeployMainnet.s.sol \
  --rpc-url https://rpc.xlayer.tech \
  --broadcast \
  --private-key $PRIVATE_KEY
```

## Post-deploy checklist

1. copy new `ExecutionRegistry`, `VaultFactory`, `OperatorVault`, and `OkxAggregatorSwapAdapter` addresses
2. update backend `.env`
3. update agent `.env`
4. update frontend config
5. authorize the intended controller addresses
6. fund the vault and the operator wallet
7. run one preview + execute cycle
