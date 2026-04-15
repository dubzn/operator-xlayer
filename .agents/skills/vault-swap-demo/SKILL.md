---
name: vault-swap-demo
description: Use when the user asks Codex to execute or preview a demo swap from a vault, especially requests like "Usa el vault 0x..., hace un swap de 1 USDT a USDC", "corre preview primero", "si está listo ejecutalo usando el backend", "ejecuta este swap desde este vault", or "hacé el swap de demo". This skill is for the live demo path where the user already created and funded the vault and authorized the controller.
---

# Vault Swap Demo

This skill is for the live demo execution path. Use it when the user wants the assistant to take a vault address, run `preview`, decide if the vault is ready, and execute through the backend only if it is safe to do so.

## First read the demo context

Read [DEMO_CONTEXT.md](../../../DEMO_CONTEXT.md) before acting. It contains the exact demo framing and the canonical commands.

## Use the single-shot demo script

Do not improvise the flow manually if the repo script already covers it.

Use:

```bash
npm run demo:swap -w @x402-operator/agent -- --vault <VAULT> --from <TOKEN_IN> --to <TOKEN_OUT> --amount <HUMAN_AMOUNT> --execute-if-ready --json
```

For preview only:

```bash
npm run demo:swap -w @x402-operator/agent -- --vault <VAULT> --from <TOKEN_IN> --to <TOKEN_OUT> --amount <HUMAN_AMOUNT> --preview-only --json
```

## Expected workflow

When the user says:

> Usa el vault 0x..., hace un swap de 1 USDT a USDC. Primero corré preview y decime si el vault está listo. Si está listo, ejecutalo usando el backend.

you should:

1. extract the vault address, token pair, and human amount
2. run the single-shot demo command with `--execute-if-ready --json`
3. inspect the JSON output
4. report whether preview was ready
5. if execution happened, report `jobId`, `txHash`, and `paymentReference`
6. if preview was not ready, stop and summarize the blockers from `riskFlags` and `warnings`

## Token inputs

- Prefer symbols `USDT` and `USDC` for the X Layer demo path.
- If the user names a token the script does not know, pass the token address directly.

## Guardrails

- Never execute if preview is not ready.
- Never skip preview in the explanation, even if the script handled it internally.
- Never claim success without a returned `jobId` and `txHash`.
- If the script exits with an error, explain whether it was an environment issue, preview validation issue, payment issue, or execution failure.

## Response shape

Keep the answer short and operational:

1. say whether the vault was ready
2. if not ready, list the blockers
3. if executed, include `jobId` and `txHash`
