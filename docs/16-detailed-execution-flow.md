# 16. Detailed Execution Flow: Backend ↔ x402 ↔ Contracts

## Full flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  CONTROLLER AGENT (TreasuryBot)                                     │
│                                                                     │
│  1. Construye ExecutionIntent:                                      │
│     { vaultAddress, controller, tokenIn, tokenOut,                  │
│       amount, maxSlippageBps, nonce, deadline }                     │
│                                                                     │
│  2. Firma EIP-712 con su private key                                │
│     domain: { name: "X402Operator", version: "1",                   │
│              chainId: 196, verifyingContract: vaultAddress }        │
│                                                                     │
│  3. POST /execute  →  envía { intent, signature }                   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OPERATOR BACKEND                                                   │
│                                                                     │
│  4. Recibe request, detecta que no hay pago                         │
│     → Responde HTTP 402 Payment Required                            │
│     → Incluye: fee amount, payment address, payment instructions    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CONTROLLER AGENT                                                   │
│                                                                     │
│  5. Recibe el 402                                                   │
│  6. Paga el fee via x402 (tx onchain, token transfer al operator)   │
│  7. Re-envía POST /execute con proof de pago (paymentReference)     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OPERATOR BACKEND — Validación                                      │
│                                                                     │
│  8.  Verificar x402 payment (¿pagó? ¿monto correcto?)              │
│  9.  Verificar firma EIP-712 → recuperar controller address         │
│  10. Verificar que controller está en allowlist del vault            │
│  11. Verificar nonce no usado                                       │
│  12. Verificar deadline no expirado                                 │
│                                                                     │
│  Si algo falla → 400/401/403 con error claro                       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OPERATOR BACKEND — Preparación                                     │
│                                                                     │
│  13. Llama OnchainOS Trade API:                                     │
│      → envía tokenIn, tokenOut, amount                              │
│      ← recibe: route, quote, expectedOut, execution payload         │
│                                                                     │
│  14. (Opcional) Llama OnchainOS Market → precio actual              │
│  15. (Opcional) Llama OnchainOS Security → risk check               │
│                                                                     │
│  16. Valida que el quote cumple maxSlippageBps del intent           │
│      Si no cumple → aborta, no gasta gas                            │
│                                                                     │
│  17. Arma la transacción:                                           │
│      vault.executeSwap(intent, routeData, signature,                │
│                         paymentRef, registryAddress)                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OPERATORVAULT.SOL — Ejecución onchain                              │
│                                                                     │
│  18. Validaciones onchain (la "frontera dura"):                     │
│      ✓ msg.sender == authorizedOperator                             │
│      ✓ recover(signature) ∈ authorizedControllers                   │
│      ✓ nonce no usado → marcar como usado                           │
│      ✓ block.timestamp <= deadline                                  │
│      ✓ tokenIn y tokenOut ∈ allowedTokens                          │
│      ✓ amount <= maxAmountPerTrade                                  │
│      ✓ dailyVolume + amount <= maxDailyVolume                       │
│      ✓ block.timestamp >= lastExecution + cooldownSeconds           │
│      ✓ !paused                                                      │
│                                                                     │
│  19. Si TODO pasa:                                                   │
│      → Ejecuta el swap con la routeData (call al DEX router)       │
│      → Valida slippage post-ejecución                               │
│      → Actualiza dailyVolume, lastExecution                         │
│      → Emite ExecutionSucceeded event                               │
│                                                                     │
│  20. Si ALGO falla → revert (gas perdido, pero fondos seguros)      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  EXECUTIONREGISTRY.SOL — Receipt                                    │
│                                                                     │
│  21. El vault (o el operator) llama al registry:                    │
│      → Graba receipt: jobId, vault, controller, operator,           │
│        paymentRef, txHash, tokenIn/Out, amountIn/Out,               │
│        realizedSlippage, timestamp, status                          │
│      → Actualiza track record: successCount++,                      │
│        avgSlippageDeltaBps                                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OPERATOR BACKEND — Respuesta                                       │
│                                                                     │
│  22. Retorna al controller:                                         │
│      { status: "success", jobId, txHash, receiptRef }               │
└─────────────────────────────────────────────────────────────────────┘
```

## The 3 clear boundaries

| Boundary | Who decides | What it validates |
|---|---|---|
| **x402 (payment)** | Backend | "Did you pay for the service?" |
| **EIP-712 signature** | Backend + Vault | "Did the controller authorize this exact action?" |
| **Onchain policy** | Vault (only) | "Does the action comply with the owner's rules?" |

## Redundant validation by design

The backend validates **before** spending gas (steps 8-16). The vault **re-validates everything onchain** (step 18). This is intentionally redundant — the backend filters junk to avoid wasting gas, but the vault is the final authority.

## Key identifiers

- `intentHash` = hash of the signed ExecutionIntent fields
- `jobId = keccak256(intentHash, paymentReference)` = canonical identifier of a paid execution attempt
- `paymentReference` = proof linking the x402 payment to this specific job

## What the controller signs (EIP-712)

The controller signs the execution bounds, NOT the route data:
- vaultAddress
- controller
- tokenIn / tokenOut
- amount
- maxSlippageBps
- nonce
- deadline

The route/quote is backend-prepared after the signature. The vault enforces that the execution result stays within the signed bounds.
