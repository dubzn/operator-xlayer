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
- **GET /health** — Health check

**Archivos clave:**
- `src/config.ts` — env vars, provider, operator wallet. **chainId dinámico** via `CHAIN_ID` env
- `src/abi.ts` — ABIs human-readable del vault, registry y ERC20
- `src/middleware/x402.ts` — Challenge 402 + verificación de pago onchain
- `src/services/intentValidator.ts` — Validación offchain + snapshot de policy
- `src/services/onchainExecutor.ts` — Arma y envía la tx al vault
- `src/services/onchainos.ts` — **MockRouter mode** (`USE_MOCK_ROUTER=true`) genera calldata real para el MockRouter. Stub para OnchainOS real cuando no está en mock mode.
- `src/services/paymentLedger.ts` — **Persistente en JSON** — guarda payment references consumidos en `payment-ledger.json`

Dependencias: `express`, `ethers`, `dotenv`.

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
- **Auto-refresh** cada 10 segundos

**Stack:** React 19, viem 2.x, Vite 8. Sin wagmi ni framework pesado.

Dev server: `cd packages/frontend && npm run dev` (puerto 5173).

---

### Demo Agent — `packages/agent/`

Script `src/run.ts` que ejecuta el flow completo:
1. Construye `ExecutionIntent`
2. Firma EIP-712
3. POST `/execute` → recibe `402`
4. Paga el fee (transfer ERC20 al operator)
5. Re-POST `/execute` con `paymentReference`
6. Imprime resultado

Dependencias: `ethers`, `dotenv`, `@x402-operator/shared`.

Typecheck: `npm run typecheck -w @x402-operator/agent`

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

### Crítico para producción

1. **Wiring OnchainOS Trade API** — `packages/backend/src/services/onchainos.ts`
   - Hoy en testnet usa MockRouter (`USE_MOCK_ROUTER=true`)
   - Falta quote real + calldata real compatible con un DEX router en X Layer
   - Cuando esté listo, setear `USE_MOCK_ROUTER=false` y configurar la API

2. **Deploy a X Layer mainnet (chain 196)**
   - Cambiar `CHAIN_ID=196` en los .env
   - Addresses reales de USDT, USDC y un DEX router
   - OKB para gas
   - Re-deployar Factory + Registry con el router real

3. **Separar wallets**
   - Hoy owner/operator/controller son la misma wallet para simplificar testeo
   - Para producción necesitan ser wallets distintas

### Mejoras pendientes

4. **Binding pago ↔ intent más fuerte**
   - Hoy el backend verifica que hubo un fee payment válido del controller al operator
   - Pero ese pago no queda ligado criptográficamente al `intentHash`
   - Para MVP sirve, pero no es el binding ideal de largo plazo

5. **Receipt más rico si hace falta**
   - Hoy el registry onchain guarda success receipts compactos
   - Campos como `executionTxHash` o analytics richer siguen siendo offchain / abiertos

6. **Frontend: historial de ejecuciones**
   - Mostrar receipts pasados en el dashboard (leer eventos del registry)
   - Track record del operator

7. **OnchainOS Market/Security**
   - Opcional para enriquecer preview y warnings

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
| Frontend stack | React + viem (sin wagmi) | Mínimo, directo, sin abstracciones innecesarias |
