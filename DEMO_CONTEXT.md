# Demo Context

This repo is set up to demonstrate a safe delegated swap flow on X Layer:

1. The user creates and funds a vault in the frontend.
2. The user authorizes a controller on that vault.
3. Codex or Claude is asked to run a swap from that vault.
4. The assistant must run `preview` first.
5. The assistant only executes if the vault is actually ready.

## Demo preconditions

Before the AI step, make sure:

- the backend is running
- the vault is funded
- the controller address is authorized on the vault
- `tokenIn`, `tokenOut`, and the pair are allowlisted
- the vault authorizes this operator backend
- the vault is registered in the shared `ExecutionRegistry`

## Local commands

Start the backend:

```bash
cd /Users/damianalejandropinones/Documents/temp/agentic/operator-xlayer/packages/backend
npm run dev
```

Run the single-shot demo swap script:

```bash
cd /Users/damianalejandropinones/Documents/temp/agentic/operator-xlayer
npm run demo:swap -w @x402-operator/agent -- --vault 0x... --from USDT --to USDC --amount 1 --execute-if-ready --json
```

Preview only:

```bash
cd /Users/damianalejandropinones/Documents/temp/agentic/operator-xlayer
npm run demo:swap -w @x402-operator/agent -- --vault 0x... --from USDT --to USDC --amount 1 --preview-only --json
```

## Expected AI behavior

When the user says:

> Usa el vault 0x..., hace un swap de 1 USDT a USDC. Primero corré preview y decime si el vault está listo. Si está listo, ejecutalo usando el backend.

the assistant should:

1. run the single-shot demo script with `--execute-if-ready`
2. inspect the preview result
3. report whether the vault was ready
4. if ready, report the execution result with `jobId` and `txHash`
5. if not ready, stop and explain the blockers

## Supported demo symbols

The demo script resolves these X Layer symbols out of the box:

- `USDT`
- `USDC`

For other assets, pass the token address directly.
