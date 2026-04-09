# Handoff — Estado actual del proyecto

## Qué hay implementado

### Contratos (Foundry) — `packages/contracts/`

**OperatorVault.sol** — Contrato core, bastante avanzado.
- Custodia fondos del owner con policy enforcement
- `executeSwap()` hace las validaciones onchain del MVP:
  1. Vault no pausado
  2. Vault address match
  3. EIP-712 signature recovery
  4. `intent.controller` debe coincidir con el signer recuperado
  5. Controller autorizado
  6. Nonce no reusado
  7. Deadline no expirado
  8. `tokenIn = baseToken`
  9. `tokenOut` en allowlist
  10. Amount <= maxAmountPerTrade
  11. Daily volume <= maxDailyVolume (UTC day bucket)
  12. Cooldown entre ejecuciones
  13. Slippage post-swap (`minAmountOut`)
- Owner functions: deposit, withdraw, pause/unpause, authorizeController, revokeController, addAllowedToken, removeAllowedToken, updatePolicy
- Swap ejecuta via `trustedRouter.call(routeData)` — el router está hardcodeado en el vault por seguridad
- Auto-registra success receipt en `ExecutionRegistry`
- EIP-712 domain: `{name: "X402Operator", version: "1", chainId: <from chain>, verifyingContract: vaultAddress}`

**VaultFactory.sol** — Factory para que usuarios creen vaults desde el frontend.
- `createVault(baseToken, maxPerTrade, maxDailyVolume, maxSlippageBps, cooldown)` — caller queda como owner
- Auto-registra el vault en el ExecutionRegistry (via authorized factory pattern)
- `getVaultsByOwner(address)` para listar vaults de un usuario
- Operator y trustedRouter son compartidos (seteados en el constructor del factory)

**ExecutionRegistry.sol** — Registry con soporte para factories.
- Guarda receipts por `jobId`
- `recordReceipt()` + `getReceipt()` + evento `ReceiptRecorded`
- Access control: solo vaults autorizados pueden grabar receipts
- `authorizeVault()` puede ser llamado por el owner **o por factories autorizados**
- `authorizeFactory()` / `revokeFactory()` — solo owner
- Lleva `successCount` simple por operator

**MockRouter.sol** — Router de testnet que simula swaps.
- `swap(tokenIn, tokenOut, amountIn, amountOut)` — transfiere tokens 1:1 con spread configurable
- Requiere estar fondeado con tokenOut previamente

**Tests**
- Los tests del contrato cubren controller mismatch, access control del registry y success count.
- `forge build` compila exitosamente con Solidity 0.8.24.

**Deploy scripts**
- `script/Deploy.s.sol` — Script original para deploy manual
- `script/DeployTestnet.s.sol` — Deploy V1 con MockRouter (deprecated)
- `script/DeployTestnetV2.s.sol` — Deploy V2 con Factory + Registry + MockRouter + test vault
- `script/DeployFactory.s.sol` — Deploy standalone del Factory
- `script/DeployMainnet.s.sol` — Deploy para mainnet con OKX DEX router (`0xbec6d0E...`) como trustedRouter

**Config:** Foundry con `via_ir = true`, Solidity 0.8.24, `libs = ["lib"]`.

---

### Shared package — `packages/shared/`

Tipos y utilidades compartidas entre backend y agent:

- **types.ts**: `ExecutionIntent`, `ExecutionReceipt`, `ExecuteRequest`, `ExecuteResponse`, `PreviewRequest`, `ExecutionPreview`, `TrackRecord`, `PaymentChallenge`
- **eip712.ts**: `signIntent()`, `recoverIntentSigner()`, `hashIntent()`, `computeJobId()`, `getDomain()`, constantes EIP-712
  - **chainId dinámico**: lee de `process.env.CHAIN_ID` (default 196 mainnet, 1952 testnet)

Compila con `npm run build -w @x402-operator/shared`.

---

### Backend — `packages/backend/`

Express server con estos endpoints:

- **POST /preview**
  1. Lee vault state y policy
  2. Corre un preflight informativo sin cobrar
  3. Devuelve fee estimado, route summary, policy check summary, warnings y expiry

- **POST /execute**
  1. Hace free pre-validation antes del cobro
  2. Si falta `paymentReference` → responde `402`
  3. Si hay payment → verifica tx onchain con chequeo de token, payer esperado, recipient operator y amount mínimo
  4. Bloquea reuse del mismo `paymentReference` — **persistido en JSON** (`payment-ledger.json`)
  5. Valida intent offchain (signature, controller, nonce, deadline, `baseToken`, allowlist, amount, daily volume, cooldown, pause)
  6. Llama OnchainOS Trade API / MockRouter → obtiene `routeData`
  7. Calcula `minAmountOut` usando `min(policy, intent)` para slippage
  8. Llama `vault.executeSwap()` onchain
  9. Retorna `{status, jobId, txHash}`

- **GET /receipts/:jobId** — Lee el receipt del registry
- **GET /operator/track-record** — Lee `successCount` del registry
- **GET /events/:vaultAddress** — Eventos indexados del vault (del indexer)
- **POST /indexer/watch** — Registra un vault para monitoreo del indexer
- **GET /health** — Health check

**Archivos clave:**
- `src/config.ts` — env vars, provider, operator wallet. **chainId dinámico** via `CHAIN_ID` env
- `src/abi.ts` — ABIs human-readable del vault, registry y ERC20
- `src/middleware/x402.ts` — Challenge 402 + verificación de pago onchain
- `src/services/intentValidator.ts` — Validación offchain + snapshot de policy
- `src/services/onchainExecutor.ts` — Arma y envía la tx al vault
- `src/services/onchainos.ts` — **Dual mode:** MockRouter (`USE_MOCK_ROUTER=true`) para testnet, OKX DEX Aggregator API v6 para mainnet. Auth via HMAC-SHA256 con headers OK-ACCESS-*. Endpoint: `GET /api/v6/dex/aggregator/swap`.
- `src/services/paymentLedger.ts` — **Persistente en JSON** — guarda payment references consumidos en `payment-ledger.json`
- `src/services/indexer.ts` — Event poller: arranca desde bloque actual, chunks de 99 bloques, parsea 7 tipos de evento, persiste en `vault-events.json`

Dependencias: `express`, `ethers`, `cors`, `dotenv`.

Compila con `npm run build -w @x402-operator/backend`.

---

### Frontend — `packages/frontend/`

React + Vite + TypeScript + viem. Single page app.

**Funcionalidades:**
- **Connect Wallet** — MetaMask, auto-configura X Layer Testnet (chain 1952)
- **Vault Selector** — lista vaults del usuario via `VaultFactory.getVaultsByOwner()`
- **Create Vault** — formulario que llama `VaultFactory.createVault()`, auto-muestra el dashboard del nuevo vault
- **Vault Dashboard** (read-only para cualquiera, write para owner):
  - Balances USDT/USDC del vault
  - Daily volume usado vs límite
  - Policy completa (max trade, daily, slippage, cooldown)
  - Operator address y last execution timestamp
  - Status badge (ACTIVE / PAUSED)
- **Owner actions:**
  - Deposit USDT (approve + deposit en una tx)
  - Authorize Controller (bot wallet)
  - Add Allowed Token
  - Pause / Unpause vault
- **Vault History** — tabla de eventos indexados: swaps (con amountIn/Out y controller), deposits, withdrawals, controller auth/revoke, pause/unpause. Links al explorer. Polling cada 10s via backend indexer.
- **Auto-refresh** cada 10 segundos

**Stack:** React 19, viem 2.x, Vite 8. Sin wagmi ni framework pesado.

Dev server: `cd packages/frontend && npm run dev` (puerto 5173).

---

### Trading Agent — `packages/agent/`

Bot autónomo (`src/run.ts`) que ejecuta el flow x402 completo en loop:
1. Construye `ExecutionIntent` con parámetros configurables
2. `POST /preview` — verifica viabilidad (policy checks, risk flags, quote)
3. Firma EIP-712
4. `POST /execute` → recibe `402` challenge
5. Paga el fee (transfer ERC20 al operator)
6. Re-POST `/execute` con `paymentReference`
7. Log resultado, espera `INTERVAL_MS`, repite

**Configuración:**
- `SWAP_AMOUNT` — monto por ronda
- `INTERVAL_MS` — intervalo entre rondas (default 30s)
- `MAX_ROUNDS` — 0 = infinito, 1 = single-shot para demos
- Graceful shutdown con SIGINT (Ctrl+C), muestra score final

Dependencias: `ethers`, `dotenv`, `@x402-operator/shared`.

Run: `npm run start -w @x402-operator/agent`

---

## Testnet Deploy (X Layer testnet, chain 1952)

Ver `docs/testnet-deployment.md` para detalles completos de network config, faucet, tokens y addresses.

**Contratos V2 (2026-04-08):**

| Contrato | Address |
|---|---|
| MockRouter | `0x54Bf470359EaE4A9BEe20F587Df9dc20C333e25F` |
| ExecutionRegistry | `0x3d77c98D4E0f150Fd28D3A12708fd0300076ce97` |
| VaultFactory | `0xdA3f23F937d530120F1DeAcBDA08770b1CF99CA7` |
| TestVault (via factory) | `0x6C50552803c7f2E26ff3452cB768FA4A8d7969Cb` |

**E2E testeado exitosamente** — swap 1 USDT → 0.99 USDC via MockRouter, receipt en registry, payment ledger persistido.

---

## Qué sigue faltando

### Para demo en mainnet

1. **Obtener API keys OKX DEX** — crear proyecto en https://web3.okx.com/build/dev-portal
2. **Fondear wallet en X Layer mainnet** — OKB para gas + USDT/USDC
3. **Deploy contratos en mainnet** — `forge script DeployMainnet.s.sol --rpc-url https://rpc.xlayer.tech --broadcast`
4. **Configurar .env** — `CHAIN_ID=196`, `USE_MOCK_ROUTER=false`, OKX credentials, nuevas addresses
5. **Verificar token addresses** — confirmar USDT/USDC en explorer mainnet
6. **Actualizar frontend** — `config/contracts.ts` con addresses y chain ID 196

### Mejoras pendientes

7. **Separar wallets** — hoy owner/operator/controller son la misma wallet para testeo
8. **Binding pago ↔ intent más fuerte** — el pago no queda ligado criptográficamente al intentHash
9. **Deploy frontend** a Vercel/Netlify para acceso público
10. **Video demo** para presentación del hackathon
11. **Withdraw desde frontend** — falta UI para retirar fondos del vault
12. **Filtros en historial** — filtrar por tipo de evento

---

## Cómo correr

```bash
# Root build
npm install
npm run build
npm run typecheck

# Contratos
cd packages/contracts
forge build
forge test -vvv

# Backend (terminal 1)
cd packages/backend
# editar .env si es necesario
npx tsx src/index.ts

# Agent (terminal 2)
cd packages/agent
# editar .env si es necesario
npx tsx src/run.ts

# Frontend (terminal 3)
cd packages/frontend
npm install
npm run dev
```

Los `.env` de backend y agent ya están configurados para testnet con las addresses V2 deployadas.

## Nota importante sobre lints

Hoy el repo tiene **build** y **typecheck**, pero **no tiene ESLint/Biome configurado para backend/shared/agent**. El frontend tiene ESLint via Vite scaffold.

## Decisiones técnicas importantes

| Decisión | Qué se eligió | Por qué |
|---|---|---|
| `trustedRouter` en vault | Hardcodeado, no viene como param | Previene que el operator llame contratos arbitrarios |
| `routeData` no firmado | Controller firma solo los bounds | La ruta la prepara el backend después de la firma |
| `baseToken` | `tokenIn` debe ser `baseToken` | Alineado con la spec cerrada del MVP |
| controller binding | `intent.controller` debe igualar al signer recuperado | Evita que el operator presente una firma válida con otro controller declarado |
| `minAmountOut` como param | Backend lo computa y lo pasa | El vault valida post-swap que `amountOut >= minAmountOut` |
| cooldown | Per-vault | Alineado con la spec cerrada |
| daily volume | UTC day bucket | Simplifica contrato y tests del MVP |
| x402 execute flow | Pre-validación gratis antes del 402 | Alineado con docs |
| payment replay guard | **Persistido en JSON** | Sobrevive restarts del backend |
| jobId | `keccak256(intentHash, paymentRef)` | Canónico entre contrato y backend |
| chainId | **Dinámico via env** (`CHAIN_ID`) | Permite testnet (1952) y mainnet (196) sin cambiar código |
| VaultFactory | Factory pattern con auto-registro | Usuarios crean vaults desde el frontend sin intervención del operator |
| Factory → Registry | Factory autorizado puede registrar vaults | Evita que el owner del registry tenga que autorizar cada vault manualmente |
| MockRouter en testnet | `USE_MOCK_ROUTER=true` | Permite testing e2e sin depender de un DEX real |
| OKX DEX en mainnet | `USE_MOCK_ROUTER=false` + API v6 | Swaps reales via OKX DEX Aggregator con HMAC-SHA256 auth |
| Indexer start block | Bloque actual al arrancar | Solo indexa eventos nuevos, no escanea historial |
| Agent loop | Configurable via INTERVAL_MS + MAX_ROUNDS | Single-shot para demos, loop para operación continua |
| Frontend stack | React + viem (sin wagmi) | Mínimo, directo, sin abstracciones innecesarias |
