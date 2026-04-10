# X402 Operator

> Ejecucion segura de swaps para agentes en X Layer sin ceder custodia.

**Estado:** Codebase mainnet-first para X Layer (chain 196). El repo actual implementa `swap-v2`: vaults con adapters, routing via OKX DEX, binding tipado del quote con `executionHash` y pago `x402` por ejecucion.

## Que es

X402 Operator es una primitive de infraestructura para ejecucion delegada onchain.

Un owner deposita capital en un vault, define guardrails de riesgo y autoriza uno o mas controllers. Un controller agent decide cuando actuar, pide un preview al operator, firma un `ExecutionIntent`, paga el fee via `x402`, y el operator ejecuta solo si la policy del vault todavia lo permite.

El producto no es "crea tu agente aca". El producto es:

- mantener el capital en un vault
- dejar que agentes pidan ejecucion
- obligar a que toda ejecucion pase por policy onchain
- cobrar el servicio de ejecucion con `x402`

## Que existe hoy

La implementacion actual es intencionalmente acotada y fuerte:

- ejecucion delegada solo para swaps
- vaults listos para multiples adapters
- primer adapter conectado al OKX DEX Aggregator
- allowlists por `tokenIn`, `tokenOut` y `tokenIn -> tokenOut`
- preview con `executionHash` para atar quote y ejecucion
- intents EIP-712 firmados (`version = "2"`)
- receipts onchain y track record del operator

Eso hace que hoy el sistema sea especialmente bueno para:

- trader agents que rotan posiciones
- rebalancers
- bots de rotacion de portfolio
- treasury automation basada en swaps

No lo vendemos todavia como una capa universal para cualquier accion DeFi.

## Quien aporta el agente

El owner no necesita crear un agente dentro del producto.

Este repo trae un controller de referencia en `packages/agent`, pero el controller autorizado puede ser:

- el bot del propio owner
- un agente de estrategia de terceros
- una integracion de protocolo
- el agente demo del repo

Lo importante es:

- el owner autoriza la address del controller
- el controller firma el intent tipado
- el vault enforcea la policy onchain

## Por que el agente paga via x402

`x402` paga el servicio de ejecucion del operator, no el acceso al capital del vault.

Hay dos flujos de dinero separados:

1. **Capital del vault**
   - pertenece al owner
   - permanece dentro del vault
   - esta restringido por policy onchain

2. **Fee del operator**
   - lo paga el caller agent via `x402`
   - remunera preview, validacion, routing, envio de transaccion y ejecucion
   - no da permiso por si solo para mover fondos del vault

La autorizacion real sigue viniendo de:

- la allowlist de controllers
- la firma EIP-712
- la policy onchain del vault

## Arquitectura

```text
┌──────────────┐   preview + firma  ┌──────────────┐   executeSwap   ┌──────────────┐
│ Controller   │ ─────────────────▶ │   Operator   │ ──────────────▶ │ OperatorVault │
│   Agent      │   paga fee (402)   │   Backend    │   via adapter   │   (onchain)   │
└──────────────┘                    └──────────────┘                  └──────────────┘
        │                                     │                               │
        │                                     │                               ▼
        │                                     │                        ┌──────────────┐
        │                                     └──── OKX DEX quote ───▶ │ Execution    │
        │                                                              │ Registry     │
        └──────────── preview / execute API ◀───────────────────────────└──────────────┘
```

- **Vault Owner** configura policy, deposita capital y autoriza controllers
- **Controller Agent** pide swaps y firma el intent final
- **Operator Backend** hace preview, cobra via `x402`, valida y envia la ejecucion
- **OperatorVault** custodia fondos y enforcea policy onchain
- **Swap Adapter** abstrae el venue de ejecucion; hoy el backend soporta el adapter de OKX
- **ExecutionRegistry** guarda receipts y track record simple del operator

## Modelo de ejecucion swap-v2

El flujo actual es:

1. El owner crea y fondea un vault
2. El owner configura:
   - allowlist de controllers
   - allowlist de input tokens
   - allowlist de output tokens
   - pares permitidos
   - adapters permitidos
   - max per trade, daily volume, slippage y cooldown
3. El controller manda un preview request borrador
4. El backend pide quote a OKX DEX, calcula `executionHash`, deriva el piso de `minAmountOut` segun policy y devuelve el preview
5. El controller firma el `ExecutionIntent` final con:
   - adapter
   - amountIn
   - quotedAmountOut
   - minAmountOut
   - nonce
   - deadline
   - `executionHash`
6. El controller llama a `POST /execute`
7. El backend responde HTTP `402`
8. El controller paga el fee y reenvia con `paymentReference`
9. El backend valida pago, quote cacheado, firma y estado del vault
10. El backend llama a `vault.executeSwap(...)`
11. El vault re-valida onchain y registra un receipt

## Que enforcea el vault onchain

Todo swap delegado vuelve a pasar por checks duros en el vault:

- vault no pausado
- vault address igual al intent
- adapter allowlisted
- signer recuperado igual a `intent.controller`
- controller autorizado
- nonce no usado
- deadline no expirado
- input token allowlisted
- output token allowlisted
- pair allowlisted
- amount dentro del per-trade cap
- daily volume respetado
- cooldown cumplido
- `executionHash` igual al calldata exacto de ejecucion
- `intent.minAmountOut` no mas debil que el piso de policy
- `amountOut` realizado al menos igual a `intent.minAmountOut`

Esa es la frontera de confianza principal del sistema.

## Que agrega el operator ademas de OKX

OKX aporta routing. X402 Operator agrega:

- separacion de custodia
- autorizacion de controllers
- guardrails por par
- binding tipado del quote con `executionHash`
- fee flow con `x402`
- receipts y track record onchain

Por eso no somos "solo un wrapper de OKX" ni "solo un relayer".

## Packages

| Package | Descripcion |
|---|---|
| `packages/contracts` | Contratos Solidity: vault, factory, adapter y registry |
| `packages/shared` | Tipos compartidos y helpers EIP-712 |
| `packages/backend` | Servicio operator en Express: preview, execute, x402, validacion |
| `packages/agent` | Controller agent de referencia |
| `packages/frontend` | Dashboard React para crear vaults y monitorear |

## Quick start

### Prerrequisitos

- Node.js 20+
- [Foundry](https://book.getfoundry.sh/)
- MetaMask

### Build y ejecucion

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

Los `.env.example` de backend y agent ya vienen alineados con el flujo actual de mainnet e incluyen:

- `SWAP_ADAPTER_ADDRESS`
- credenciales OKX
- `OKX_DEX_IDS` / `OKX_EXCLUDE_DEX_IDS` opcionales

## Deployment mainnet

Ver [docs/mainnet-deployment.md](docs/mainnet-deployment.md) para constantes de red, shape del deploy actual y notas sobre refrescar direcciones cuando se despliegan los contratos `swap-v2`.

## FAQ

### El usuario crea su propio agente?

No necesariamente. El usuario autoriza una address controller. Ese controller puede ser propio, de terceros, una integracion de protocolo o el agente demo del repo.

### x402 paga acceso al vault?

No. `x402` paga execution-as-a-service. El capital sigue en el vault y solo puede moverse si el request firmado tambien pasa la policy onchain.

### Esto es solo un wrapper de OKX?

No. OKX entrega routing. X402 Operator agrega la frontera de custodia, la autorizacion de controllers, los guardrails por par, el binding del quote, el flujo `x402` y los receipts onchain.

## Documentos clave

- [Architecture & Flow](docs/architecture.md)
- [API and Types](docs/10-api-and-types.md)
- [Vault Spec](docs/05-vault-spec.md)
- [Detailed Execution Flow](docs/16-detailed-execution-flow.md)
- [Mainnet Deployment](docs/mainnet-deployment.md)
- [Handoff](HANDOFF.md)
