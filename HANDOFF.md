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
- EIP-712 domain: `{name: "X402Operator", version: "1", chainId: 196, verifyingContract: vaultAddress}`

**ExecutionRegistry.sol** — Minimal, funcional.
- Guarda receipts por `jobId`
- `recordReceipt()` + `getReceipt()` + evento `ReceiptRecorded`
- Tiene access control: solo vaults autorizados pueden grabar receipts
- Lleva `successCount` simple por operator

**Tests**
- Los tests del contrato fueron ampliados para cubrir controller mismatch, access control del registry y success count.
- En este workspace, **no pude re-verificar `forge test` localmente** porque Foundry no tiene todavía el compilador `solc 0.8.24` instalado y `packages/contracts/lib/` no está bootstrappeado.

**Deploy script** — `script/Deploy.s.sol`
- Lee `BASE_TOKEN`
- Autoriza el vault en el registry
- Trata `baseToken` y `allowed tokenOut` según la spec cerrada

**Config:** Foundry con `via_ir = true`, Solidity 0.8.24, `libs = ["lib"]`.

---

### Shared package — `packages/shared/`

Tipos y utilidades compartidas entre backend y agent:

- **types.ts**: `ExecutionIntent`, `ExecutionReceipt`, `ExecuteRequest`, `ExecuteResponse`, `PreviewRequest`, `ExecutionPreview`, `TrackRecord`, `PaymentChallenge`
- **eip712.ts**: `signIntent()`, `recoverIntentSigner()`, `hashIntent()`, `computeJobId()`, `getDomain()`, constantes EIP-712

Compila con `npm run build -w @x402-operator/shared`.

---

### Backend — `packages/backend/`

Express server con estos endpoints:

- **POST /preview**
  1. Lee vault state y policy
  2. Corre un preflight informativo sin cobrar
  3. Devuelve fee estimado, route summary, policy check summary, warnings y expiry
  4. Hoy sigue siendo parcialmente informativo porque `onchainos.ts` todavía es stub

- **POST /execute**
  1. Hace free pre-validation antes del cobro
  2. Si falta `paymentReference` → responde `402`
  3. Si hay payment → verifica tx onchain con chequeo de token, payer esperado, recipient operator y amount mínimo
  4. Bloquea reuse obvio del mismo `paymentReference` dentro de la misma instancia backend
  5. Valida intent offchain (signature, controller, nonce, deadline, `baseToken`, allowlist, amount, daily volume, cooldown, pause)
  6. Llama OnchainOS Trade API stub → obtiene `routeData`
  7. Calcula `minAmountOut` usando `min(policy, intent)` para slippage
  8. Llama `vault.executeSwap()` onchain
  9. Retorna `{status, jobId, txHash}`

- **GET /receipts/:jobId**
  - Lee el receipt del registry

- **GET /operator/track-record**
  - Lee `successCount` del registry

- **GET /health**
  - Health check

**Archivos clave:**
- `src/config.ts` — env vars, provider, operator wallet
- `src/abi.ts` — ABIs human-readable del vault, registry y ERC20
- `src/middleware/x402.ts` — Challenge 402 + verificación de pago onchain
- `src/services/intentValidator.ts` — Validación offchain + snapshot de policy
- `src/services/onchainExecutor.ts` — Arma y envía la tx al vault
- `src/services/onchainos.ts` — ⚠️ **STUB** — devuelve routeData vacío
- `src/services/paymentLedger.ts` — guardia MVP en memoria contra reuse de payment references

Compila con `npm run build -w @x402-operator/backend`.

---

### Demo Agent — `packages/agent/`

Script `src/run.ts` que ejecuta el flow completo:
1. Construye `ExecutionIntent`
2. Firma EIP-712
3. POST `/execute` → recibe `402`
4. Paga el fee (transfer ERC20 al operator)
5. Re-POST `/execute` con `paymentReference`
6. Imprime resultado

Typecheck: `npm run typecheck -w @x402-operator/agent`

---

## Qué sigue faltando

### Crítico para que funcione end-to-end real

1. **Wiring OnchainOS Trade API** — `packages/backend/src/services/onchainos.ts`
   - Hoy es un stub que devuelve `routeData: "0x"`
   - Falta quote real + calldata real compatible con `trustedRouter`

2. **Bootstrapping de Foundry en esta máquina**
   - falta `solc 0.8.24`
   - falta `packages/contracts/lib/` con dependencias (`forge-std`, `openzeppelin-contracts`)
   - hasta eso, `forge build/test` no se puede verificar localmente acá

3. **Deploy a X Layer testnet / mainnet**
   - RPC real
   - OKB para gas
   - addresses reales de tokens y router
   - `.env` reales para backend y agent

### Mejoras pendientes

4. **Persistencia real para payment references**
   - hoy el anti-replay de payments es solo in-memory
   - sobrevive al proceso, no a reinicios ni a múltiples réplicas backend

5. **Binding pago ↔ intent más fuerte**
   - hoy el backend verifica que hubo un fee payment válido del controller al operator
   - pero ese pago todavía no queda ligado criptográficamente al `intentHash`
   - para MVP sirve como approximation, pero no es el binding ideal de largo plazo

6. **Receipt más rico si hace falta**
   - hoy el registry onchain guarda success receipts compactos
   - campos como `executionTxHash` o analytics richer siguen siendo offchain / abiertos

7. **Consola web**
   - UI read-only mostrando vault state, receipts, track record

8. **OnchainOS Market/Security**
   - opcional para enriquecer preview y warnings

---

## Cómo correr

```bash
# Root checks
npm install
npm run build
npm run typecheck

# Contratos (cuando Foundry esté bootstrappeado)
cd packages/contracts
forge build
forge test -vvv

# Backend
cd packages/backend
cp .env.example .env
# editar .env con values reales
npx tsx src/index.ts

# Agent
cd packages/agent
cp .env.example .env
# editar .env
npx tsx src/run.ts
```

## Nota importante sobre lints

Hoy el repo tiene **build** y **typecheck**, pero **no tiene ESLint/Biome configurado todavía**. Si alguien habla de "lint", en la práctica hoy se refiere más a typechecking que a un linter de estilo real.

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
| payment replay guard | En memoria por ahora | Cierra el hueco obvio en MVP, aunque todavía no es persistente |
| jobId | `keccak256(intentHash, paymentRef)` | Canónico entre contrato y backend |
