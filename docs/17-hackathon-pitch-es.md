# Hackathon Pitch

## One-liner

X402 Operator es la capa de ejecucion segura de swaps para agentes en X Layer: permite que un agente opere capital real sin recibir custodia total, firme el quote exacto que va a ejecutar y pague la ejecucion via `x402`.

## Pitch corto (30 segundos)

Hoy, para que un agente opere capital real, casi siempre terminas en una mala eleccion: o le das demasiados permisos sobre una wallet, o cortas la autonomia con firmas manuales. X402 Operator crea una tercera via. El owner deposita fondos en un vault onchain, define guardrails por token, par y riesgo, y autoriza un controller. El agente pide un preview, firma el paquete exacto de ejecucion, paga al operator via `x402`, y el operator solo puede ejecutar si el vault lo permite. No somos otro bot trader: somos la capa de ejecucion segura para agentes en X Layer.

## Pitch principal (90 segundos)

Los agentes ya pueden analizar mercados, leer senales y decidir estrategias. El problema mas dificil ya no es pensar. El problema es ejecutar sin entregar custodia total del capital.

X402 Operator resuelve exactamente esa capa.

En nuestro modelo, el owner no le entrega una wallet libre al agente. Deposita el capital en un vault onchain, configura limites de riesgo y autoriza uno o mas controllers. Ese controller puede ser el bot del propio usuario, un agente de terceros o una integracion de protocolo.

Cuando el agente quiere actuar, primero pide un preview. El operator consulta routing en OKX DEX, calcula el `executionHash`, deriva el `minAmountOut` seguro segun policy y le devuelve el paquete exacto que puede firmar. Despues el controller firma un `ExecutionIntent` tipado, paga al operator via `x402`, y el operator intenta ejecutar. Pero no puede hacerlo libremente: el vault vuelve a validar controller, adapter, input token, output token, pair, caps, cooldown, slippage y `executionHash` antes de mover fondos.

Eso nos da una separacion clara de roles: el owner conserva el capital, el agente conserva la autonomia estrategica y el operator presta execution-as-a-service.

No estamos construyendo otro agente DeFi aislado. Estamos construyendo el execution rail seguro que pueden usar trader agents, rebalancers y portfolio rotators cuando quieran tocar capital real sin recibir una wallet con permisos amplios.

## Pitch extendido (2 minutos)

La economia de agentes necesita mas que agentes inteligentes. Necesita rails de ejecucion confiables.

Hoy, si queres que un agente actue sobre capital real, casi siempre terminas en uno de dos extremos: o le das demasiado poder sobre una wallet, con todos los riesgos que eso implica, o mantenes al humano firmando cada paso y destruis la autonomia que hacia valioso al agente en primer lugar.

X402 Operator convierte ese tradeoff en una tercera via.

El owner deposita fondos en un vault onchain en X Layer. Desde ahi define reglas de riesgo muy concretas: que controllers estan autorizados, que tokens puede vender, que tokens puede comprar, que pares estan permitidos, que adapters puede usar y cuales son los limites de amount, volumen diario, slippage y cooldown.

Cuando el controller quiere actuar, no manda una instruccion vaga. Primero pide un preview. El operator resuelve el routing con OKX DEX, calcula un `executionHash`, deriva el piso de `minAmountOut` permitido por la policy y devuelve el paquete exacto de ejecucion. El controller firma ese paquete mediante EIP-712. Eso importa porque el agente ya no aprueba una idea generica de "hacer un swap"; aprueba el quote y el calldata exacto que el operator va a poder ejecutar.

Despues llega `x402`: el agente paga al operator por execution-as-a-service. Ese pago no compra acceso al capital del vault. Solo paga el servicio de validacion, routing y envio. La autorizacion real sigue viniendo del vault: si el controller no esta autorizado, si el pair no esta permitido, si el cooldown no paso o si el `executionHash` no coincide, la ejecucion revierte.

Eso separa de forma muy limpia tres roles que hoy suelen mezclarse: el owner conserva el capital, el agente conserva la decision y el operator conserva la infraestructura de ejecucion.

Por eso no nos presentamos como otro trading bot. Nos presentamos como la primitive que permite que agentes propios o de terceros operen capital real dentro de limites verificables.

## Que esta live hoy

- vault `swap-v2` con guardrails por input token, output token, pair y adapter
- adapter OKX para ejecucion de swaps
- preview con `executionHash` y `minAmountOut`
- `x402` como fee rail
- receipts onchain con track record del operator

## Cierre fuerte

Si la proxima ola de usuarios onchain va a estar mediada por agentes, entonces la pregunta no es solo que tan inteligente es un agente. La pregunta es como ejecuta sin convertirse en un riesgo. X402 Operator es nuestra respuesta: autonomia arriba, custodia y policy abajo, y `x402` como el rail economico entre ambas.

## Frases que conviene repetir

- No somos otro bot trader; somos execution infrastructure para agentes.
- Resolvemos el tradeoff entre autonomia y custodia.
- `x402` no paga acceso al capital; paga execution-as-a-service.
- El agente decide, el vault custodia y el operator ejecuta.
- El controller firma el quote exacto que se va a ejecutar.
- OKX aporta routing; nosotros aportamos la frontera de seguridad.

## Who uses us today

Las categorias mas naturales hoy son:

- **Trader agents** que ya generan senales y quieren ejecutar swaps dentro de limites.
- **Rebalancers** que necesitan rotar capital entre tokens sin exponer la wallet completa.
- **Portfolio rotators** que reasignan capital entre activos.
- **Treasury automations** que quieren conversiones onchain con guardrails.
- **Multi-agent systems** donde un agente decide y otro paga por la ejecucion.

La palabra importante es **hoy**. Estamos vendiendo la mejor version real del producto actual, no una promesa exagerada de automatizacion universal.

## Como decirlo en el pitch

> Muchos equipos ya estan construyendo trader agents, rebalancers y sistemas multiagente. Nosotros no competimos solo como una app mas. Construimos la capa de ejecucion segura que esos agentes pueden usar cuando quieren mover capital real sin recibir custodia total.

## Como usar a los competidores a nuestro favor

No conviene atacarlos uno por uno. Conviene usarlos como validacion de mercado.

La narrativa correcta es:

- el ecosistema ya demostro interes por agentes onchain
- eso valida que la demanda existe
- pero cuando esos agentes pasan de demo a capital real aparece una pregunta comun:
  - como ejecutan sin recibir demasiado poder sobre los fondos?
- X402 Operator resuelve exactamente esa brecha

## Frase fuerte para slide

> The ecosystem is building agent brains. We build the execution rail they can trust with capital.

## Frase fuerte para Q and A

> No vemos a todos los proyectos de agentes solo como competencia. Muchos tambien validan nuestro mercado y muestran que la demanda por agentes onchain ya existe. Nuestra apuesta es resolver la capa que se vuelve critica cuando esos agentes pasan de decidir a ejecutar capital real.

## Frases que conviene evitar

- Somos trustless.
- Somos un bot de trading con IA.
- El usuario le da su wallet al agente.
- Somos solo un wrapper de OKX.
- El pago via `x402` compra acceso al vault.
