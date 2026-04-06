# Handoff — Estado actual del proyecto

## Qué hay implementado

### Contratos (Foundry) — `packages/contracts/`

**OperatorVault.sol** — Contrato core, completo.
- Custodia fondos del owner con policy enforcement
- `executeSwap()` con 9 validaciones onchain:
  1. Vault no pausado
  2. Vault address match
  3. EIP-712 signature recovery → controller autorizado
  4. Nonce no reusado
  5. Deadline no expirado
  6. Tokens en allowlist
  7. Amount <= maxAmountPerTrade
  8. Daily volume <= maxDailyVolume (reset por UTC day bucket)
  9. Cooldown entre ejecuciones
  10. Slippage post-swap (minAmountOut)
- Owner functions: deposit, withdraw, pause/unpause, authorizeController, revokeController, addAllowedToken, removeAllowedToken, updatePolicy
- Swap ejecuta via `trustedRouter.call(routeData)` — el router está hardcodeado en el vault por seguridad
- Auto-registra receipt en ExecutionRegistry después del swap
- EIP-712 domain: `{name: "X402Operator", version: "1", chainId: 196, verifyingContract: vaultAddress}`

**ExecutionRegistry.sol** — Minimal, funcional.
- Guarda receipts por jobId
- `recordReceipt()` + `getReceipt()` + evento `ReceiptRecorded`
- Sin access control todavía (cualquiera puede llamar recordReceipt)

**Tests** — 15/15 pasan (`forge test`)
- 8 tests Phase 1: ejecución válida, operator no autorizado, controller no autorizado, nonce reusado, deadline expirado, token no permitido, amount excedido, receipt grabado
- 7 tests Phase 2: pause, unpause, daily volume excedido, cooldown no cumplido, cooldown pasa después de esperar, slippage excedido, daily volume se resetea al día siguiente

**Deploy script** — `script/Deploy.s.sol`, lee config de env vars.

**Config:** Foundry con `via_ir = true` (necesario por stack depth), Solidity 0.8.24, OpenZeppelin contracts.

---

### Shared package — `packages/shared/`

Tipos y utilidades compartidas entre backend y agent:

- **types.ts**: `ExecutionIntent`, `ExecutionReceipt`, `ExecuteRequest`, `ExecuteResponse`, `PaymentChallenge`
- **eip712.ts**: `signIntent()`, `recoverIntentSigner()`, `hashIntent()`, `computeJobId()`, `getDomain()`, constantes EIP-712

Compila con `npx tsc --project packages/shared/tsconfig.json`.

---

### Backend — `packages/backend/`

Express server con un endpoint:

- **POST /execute** — Flow completo:
  1. x402 middleware: si no hay `paymentReference` → responde 402 con fee details
  2. Si hay payment → verifica tx onchain (busca Transfer event al operator)
  3. Valida intent offchain (signature, controller allowlist, nonce, deadline, tokens, amount)
  4. Llama OnchainOS Trade API → obtiene routeData (⚠️ **STUB**, ver abajo)
  5. Llama `vault.executeSwap()` onchain
  6. Retorna `{status, jobId, txHash}`

- **GET /health** — Health check

**Archivos clave:**
- `src/config.ts` — env vars, provider, operator wallet
- `src/abi.ts` — ABIs human-readable del vault, registry y ERC20
- `src/middleware/x402.ts` — Challenge 402 + verificación de pago onchain
- `src/services/intentValidator.ts` — Validación offchain (gas-saving filter)
- `src/services/onchainExecutor.ts` — Arma y envía la tx al vault
- `src/services/onchainos.ts` — ⚠️ **STUB** — devuelve routeData vacío

Compila con `npx tsc --project packages/backend/tsconfig.json --noEmit`.

---

### Demo Agent — `packages/agent/`

Script `src/run.ts` que ejecuta el flow completo:
1. Construye ExecutionIntent
2. Firma EIP-712
3. POST /execute → recibe 402
4. Paga el fee (transfer ERC20 al operator)
5. Re-POST /execute con paymentReference
6. Imprime resultado

---

## Qué falta hacer

### Crítico para que funcione end-to-end

1. **Wiring OnchainOS Trade API** — `packages/backend/src/services/onchainos.ts`
   - Hoy es un stub que devuelve `routeData: "0x"`
   - Hay que llamar a la Trade API real de OnchainOS para obtener route + quote + calldata
   - El routeData debe ser compatible con el `trustedRouter` del vault
   - Docs: https://web3.okx.com/onchainos/dev-docs/home/what-is-onchainos

2. **Deploy a X Layer testnet**
   - Necesitamos RPC endpoint, OKB para gas, y addresses de tokens (USDT, WETH en X Layer)
   - El DEX router address hay que sacarlo de OnchainOS o de un DEX en X Layer
   - Configurar `.env` con las addresses reales

### Mejoras pendientes

3. **POST /preview** — Endpoint free que devuelve quote + policy check + warnings
4. **GET /receipts/:jobId** — Leer receipt del registry
5. **GET /operator/track-record** — Track record del operator
6. **Registry access control** — Restringir quién puede llamar `recordReceipt()`
7. **Track record counters en registry** — `successCount`, `avgSlippageDeltaBps` por operator
8. **Consola web** — UI read-only mostrando vault state, receipts, track record
9. **minAmountOut real** — En `onchainExecutor.ts` hay un `TODO` para computar minAmountOut desde el quote y el slippage

---

## Estructura del repo

```
operator-xlayer/
  docs/                          # 17 docs de diseño
  packages/
    contracts/                   # Foundry — forge build / forge test
      src/
        OperatorVault.sol
        ExecutionRegistry.sol
        interfaces/IExecutionRegistry.sol
      test/
        OperatorVault.t.sol      # 15 tests
        mocks/MockDEX.sol, MockERC20.sol
      script/Deploy.s.sol
    shared/                      # TS types + EIP-712 utils
      src/types.ts, eip712.ts, index.ts
    backend/                     # Express server
      src/index.ts, config.ts, abi.ts
      src/routes/execute.ts
      src/middleware/x402.ts
      src/services/intentValidator.ts, onchainExecutor.ts, onchainos.ts
    agent/                       # Demo controller script
      src/run.ts
  package.json                   # npm workspaces
```

## Cómo correr

```bash
# Contratos
cd packages/contracts
forge build
forge test -vvv

# Backend (necesita .env configurado)
cd packages/backend
cp .env.example .env
# editar .env con values reales
npx tsx src/index.ts

# Agent (necesita .env configurado + backend corriendo)
cd packages/agent
cp .env.example .env
# editar .env
npx tsx src/run.ts
```

## Decisiones técnicas importantes

| Decisión | Qué se eligió | Por qué |
|---|---|---|
| `trustedRouter` en vault | Hardcodeado, no viene como param | Previene que el operator llame contratos arbitrarios |
| `routeData` no firmado | Controller firma solo los bounds | La ruta la prepara el backend después de la firma |
| `minAmountOut` como param | Backend lo computa y lo pasa | El vault valida post-swap que amountOut >= minAmountOut |
| Cooldown skip en primera ejecución | `lastExecution > 0` check | Si no, el primer swap siempre falla |
| `via_ir = true` en Foundry | Habilitado en foundry.toml | Necesario por stack-too-deep en executeSwap |
| x402 Phase 1 | Simple 402 + verificación de tx hash | Refinar con spec x402 real después |
| jobId | `keccak256(intentHash, paymentRef)` | Canónico entre contrato y backend |
