# Handoff — Estado actual del proyecto

## Resumen rapido

El repo ya esta alineado a una arquitectura `swap-v2`:

- vault con allowlists por input, output, pair y adapter
- adapter OKX para ejecucion de swaps
- preview que devuelve quote, `executionHash` y `minAmountOut`
- intent EIP-712 v2 que ata preview y ejecucion
- `x402` para cobrar el servicio del operator
- receipts onchain con `adapter`

La tesis del producto sigue siendo la misma, pero la implementacion es bastante mas fuerte que la version anterior de "router fijo + baseToken only".

## Que hay implementado

### Contratos — `packages/contracts/`

**OperatorVault.sol**

- custodia fondos del owner
- enforcea policy onchain para swaps delegados
- soporta:
  - controllers autorizados
  - input token allowlist
  - output token allowlist
  - pair allowlist
  - swap adapter allowlist
  - per-trade cap
  - daily volume cap
  - cooldown
  - pause / unpause
- `executeSwap()` valida firma, policy, `executionHash`, slippage floor y output realizado
- registra receipts en `ExecutionRegistry`
- EIP-712 domain actual: `{ name: "X402Operator", version: "2", chainId, verifyingContract }`

**OkxAggregatorSwapAdapter.sol**

- primer adapter de ejecucion
- aprueba `tokenIn` al approval target de OKX
- llama al router OKX con `executionData`
- mide `amountOut` por balance delta

**VaultFactory.sol**

- crea vaults con:
  - `registry`
  - `operator`
  - `defaultSwapAdapter`
- auto-registra vaults en el registry
- expone `getVaultsByOwner`

**ExecutionRegistry.sol**

- guarda receipts por `jobId`
- cada receipt incluye `adapter`
- mantiene `successCount` por operator

**Tests**

- `forge test` corre verde con `22/22` tests pasando

### Shared package — `packages/shared/`

Comparten tipos y helpers entre backend y agent.

Hoy incluye:

- `ExecutionIntent` v2
- `ExecutionPreview`
- `ExecutionReceipt`
- `RoutePreferences`
- helpers EIP-712
- `computeExecutionHash()`
- `computeJobId()`

### Backend — `packages/backend/`

Endpoints principales:

- `POST /preview`
  - lee policy snapshot onchain
  - pide quote a OKX DEX
  - calcula `executionHash`
  - deriva `policyMinAmountOut`
  - cachea el quote por `executionHash`
  - devuelve fee, route summary, warnings y policy summary

- `POST /execute`
  - valida quote cacheado contra el intent
  - valida firma EIP-712
  - valida policy onchain en tiempo real
  - devuelve `402` si falta pago
  - verifica el pago onchain si hay `paymentReference`
  - llama a `vault.executeSwap(...)`
  - devuelve `{ status, jobId, txHash }`

- `GET /receipts/:jobId`
- `GET /operator/track-record`
- `GET /events/:vaultAddress`
- `POST /indexer/watch`
- `GET /health`

Servicios clave:

- `intentValidator.ts` — snapshot + validacion offchain
- `onchainos.ts` — cliente OKX DEX + route preferences
- `quoteCache.ts` — cache en memoria por `executionHash`
- `onchainExecutor.ts` — envio del `executeSwap`
- `paymentLedger.ts` — replay guard para payment references
- `indexer.ts` — indexador de eventos del vault

### Agent — `packages/agent/`

El agent ahora sigue el flujo correcto:

1. arma un draft intent
2. llama a `POST /preview`
3. copia `expectedOut`, `minAmountOut` y `executionHash`
4. firma el intent final
5. llama a `POST /execute`
6. paga el fee
7. reintenta con `paymentReference`

Variables importantes:

- `SWAP_ADAPTER_ADDRESS`
- `SWAP_AMOUNT`
- `INTERVAL_MS`
- `MAX_ROUNDS`
- `OKX_DEX_IDS`
- `OKX_EXCLUDE_DEX_IDS`

### Frontend — `packages/frontend/`

El frontend sigue siendo util para:

- crear vaults
- ver balances
- autorizar controllers
- depositar
- pausar / despausar
- ver historial

Pero ojo con esto:

- las nuevas superficies `swap-v2` viven primero en contratos y API
- el frontend todavia no expone toda la administracion nueva de:
  - input tokens
  - pairs
  - adapters
- despues del proximo redeploy hay que refrescar addresses y ABI para alinearlo con la implementacion actual

## Estado de verificacion

Verificado en esta base de codigo:

- `forge test` -> `22/22` pasando
- `npm run typecheck` -> pasa
- `npm run build` -> pasa

## Lo mas importante que cambio

### Antes

- vault mas rigido
- narrativa cerca de `baseToken -> tokenOut`
- quote y ejecucion menos atados
- venue acoplado al vault

### Ahora

- el vault decide por input, output, pair y adapter
- preview y execute quedan atados con `executionHash`
- el intent firma la quote final, no solo bounds genericos
- el venue se abstrae con adapter
- el backend puede aplicar `dexIds` / `excludeDexIds`

## Limites honestos del MVP actual

Hoy el producto es fuerte para:

- trader agents de swaps
- rebalancers simples
- rotacion de portfolio
- treasury conversions

Todavia no es:

- una red abierta de multiples operators
- una capa madura de reputacion economica
- una primitive universal para lending / LP / staking

## Mainnet note

El repo ahora modela `swap-v2`, pero las direcciones broadcast antiguas de mainnet corresponden a una version anterior del vault.

Traten esas direcciones como referencia historica. Para usar el flujo actual de backend + agent + contracts, hagan un deploy fresco y actualicen:

- `VAULT_ADDRESS`
- `REGISTRY_ADDRESS`
- `SWAP_ADAPTER_ADDRESS`
- config del frontend

Mas detalle en el `README.md` raiz, que ahora concentra deployment, mainnet constants y narrativa del hackathon.

## Como correr

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

## Siguientes pasos recomendados

1. redeploy `swap-v2` en mainnet y actualizar addresses
2. alinear frontend con el ABI nuevo del vault
3. exponer en UI las allowlists de input token, pair y adapter
4. grabar una demo mostrando preview -> sign -> 402 -> execute -> receipt
5. si sobra tiempo, preparar el siguiente adapter o venue mode
