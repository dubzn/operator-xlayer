# X Layer Testnet — Deployment Info

## Network Config (MetaMask / Wallet)

| Campo | Valor |
|---|---|
| Network Name | X Layer Testnet |
| RPC URL | `https://testrpc.xlayer.tech/terigon` |
| Chain ID | `1952` |
| Currency Symbol | `OKB` |
| Block Explorer | `https://web3.okx.com/explorer/x-layer-testnet` |

RPC alternativo: `https://xlayertestrpc.okx.com/terigon`

## Faucet

- **URL:** https://web3.okx.com/xlayer/faucet
- **Limite:** 0.2 OKB por día
- **Alternativo:** https://www.l2faucet.com/x-layer (device attestation)

Los tokens de testnet no tienen valor real.

## Tokens de testnet

| Token | Address | Decimals |
|---|---|---|
| OKB (nativo) | — | 18 |
| USD₮0 (USDT) | `0x9e29b3AaDa05Bf2D2c827Af80Bd28Dc0b9b4FB0c` | 6 |
| USDC_TEST | `0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D` | 6 |

## Contratos deployados (V2)

Fecha: 2026-04-08

| Contrato | Address |
|---|---|
| MockRouter | `0x54Bf470359EaE4A9BEe20F587Df9dc20C333e25F` |
| ExecutionRegistry | `0x3d77c98D4E0f150Fd28D3A12708fd0300076ce97` |
| VaultFactory | `0xdA3f23F937d530120F1DeAcBDA08770b1CF99CA7` |
| TestVault (via factory) | `0x6C50552803c7f2E26ff3452cB768FA4A8d7969Cb` |

V1 (deprecated): MockRouter `0x652c...8493`, Registry `0x2218...3A79`, Vault `0xCc02...e7C6`

## Config del TestVault

| Param | Valor |
|---|---|
| Owner | `0xF88A50ef4CfCAa82021D6b362530bc0887cB570b` |
| Operator | `0xF88A50ef4CfCAa82021D6b362530bc0887cB570b` |
| Controller | `0xF88A50ef4CfCAa82021D6b362530bc0887cB570b` |
| BaseToken | USDT (`0x9e29...FB0c`) |
| AllowedOut | USDC (`0xcB8B...c79D`) |
| TrustedRouter | MockRouter (`0x54Bf...e25F`) |
| Max per trade | 5 USDT (5000000) |
| Max daily volume | 10 USDT (10000000) |
| Max slippage | 5% (500 bps) |
| Cooldown | 10 seconds |

La misma wallet actua como owner, operator y controller para simplificar el testeo.

## VaultFactory

El factory permite a cualquier usuario crear su propio vault desde el frontend:
- `createVault(baseToken, maxPerTrade, maxDailyVolume, maxSlippageBps, cooldown)`
- Auto-registra el vault en el ExecutionRegistry
- El caller queda como owner del vault

## Broadcast

Las transacciones del deploy quedan en:
`packages/contracts/broadcast/DeployTestnetV2.s.sol/1952/run-latest.json`

## Test end-to-end exitoso

Fecha: 2026-04-08

El agent ejecuto el flow completo contra testnet:

1. Build ExecutionIntent (swap 1 USDT → USDC)
2. Firma EIP-712 (chainId 1952)
3. POST /execute → recibe 402 challenge
4. Paga fee 0.1 USDT al operator
5. Re-POST /execute con paymentReference
6. Backend valida, genera routeData via MockRouter, ejecuta vault.executeSwap()
7. Swap ejecutado: 1 USDT → 0.99 USDC (1% spread del mock)
8. Receipt registrado en ExecutionRegistry (successCount = 1)

Tx del swap: `0x73581e30cbf21fb584bcc41efaf510a55cbbddd1877ef77aa4ad2f4e1d26fb00`

## Como correr

```bash
# 1. Build
npm install && npm run build

# 2. Backend (terminal 1)
cd packages/backend
npx tsx src/index.ts

# 3. Agent (terminal 2)
cd packages/agent
npx tsx src/run.ts
```

Los .env ya estan configurados para testnet con las addresses deployadas.
