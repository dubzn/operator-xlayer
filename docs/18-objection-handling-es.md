# Objection Handling Para Jurado

## Como usar este documento

Cada objecion tiene:

- una respuesta corta de 15 a 20 segundos
- una respuesta extendida de 30 a 45 segundos
- una frase que conviene evitar

La regla general es esta: responder con honestidad, marcar el limite real del MVP y volver siempre al diferencial central del proyecto.

## 1. "Entonces ustedes son solo un relayer"

**Respuesta corta**

Incluimos una funcion de relaying, pero no somos solo un relayer. Un relayer puro reenvia una transaccion; nosotros agregamos separacion de custodia, intents firmados, guardrails por pair y adapter, binding del quote con `executionHash` y cobro via `x402`.

**Respuesta extendida**

Si esto fuera solo un relayer, el problema seguiria igual: el agente necesitaria demasiado poder sobre los fondos. En nuestro modelo, el agente decide, pero no custodia; el operator ejecuta, pero no puede salirse de la policy del vault; y el owner mantiene el capital bajo reglas onchain. El valor no esta en reenviar una transaccion, sino en crear una capa de ejecucion delegada con limites reales.

**Evitar**

"No, para nada somos un relayer."

## 2. "Esto sigue siendo centralizado porque hay un backend en el medio"

**Respuesta corta**

Si, hoy el operator es un componente offchain y no lo vendemos como trustless. Pero la frontera de seguridad importante no depende del backend: depende del vault y de los checks onchain que limitan lo que se puede ejecutar.

**Respuesta extendida**

Somos honestos con eso: hoy hay un operator offchain que valida, cotiza y envia la transaccion. Pero incluso si ese componente falla o se comporta mal, no obtiene una wallet libre ni acceso arbitrario al capital. La garantia importante esta en el vault: controller autorizado, intent firmado, pair permitido, adapter permitido y `executionHash` coincidente. Si el backend falla, se frena la ejecucion; no se libera el capital.

**Evitar**

"Es totalmente descentralizado."

## 3. "Por que hace falta `x402`? Podrian cobrar de otra forma"

**Respuesta corta**

Porque el cliente natural de este sistema es otro agente. `x402` encaja cuando software autonomo consume infraestructura por request y paga programaticamente por ejecucion.

**Respuesta extendida**

No usamos `x402` como adorno. Lo usamos porque separa muy bien el fee del operator del capital del vault. El agente paga execution-as-a-service por preview, validacion, routing y envio, pero ese pago no le da permisos sobre los fondos. En otras palabras, `x402` resuelve la monetizacion del servicio, mientras que el vault resuelve la seguridad del capital.

**Evitar**

"Usamos x402 porque era parte del hackathon."

## 4. "Si el agente es del propio usuario, por que tiene que pagar igual"

**Respuesta corta**

Porque no le esta pagando a su propio bot; le esta pagando al operator que ejecuta. El agent decide la accion y el operator presta la infraestructura para llevarla onchain.

**Respuesta extendida**

Aun si el strategy bot fuera del usuario, el operator sigue siendo un servicio aparte. Es quien cotiza, devuelve el preview, verifica pago, valida el intent y envia la transaccion. El capital del usuario queda en el vault; el fee remunera el trabajo operativo. La estrategia y la ejecucion son capas separadas.

**Evitar**

"Porque asi monetizamos."

## 5. "No seria mas facil darle session keys o permisos limitados al agente"

**Respuesta corta**

Las session keys ayudan, pero no resuelven por si solas la separacion completa entre estrategia, ejecucion y custodia. Nosotros llevamos ese control al vault con policies onchain y receipts verificables.

**Respuesta extendida**

Session keys o allowances son utiles, pero siguen dejando el problema de como acotas venue, quote y policy de una manera legible. Nosotros queremos que el capital viva en un vault dedicado, con reglas claras sobre controller, tokens, pairs y adapters. Ademas, el controller firma el quote final que se ejecuta, no solo una autorizacion amplia.

**Evitar**

"Las session keys no sirven."

## 6. "Que pasa si comprometen al operator o al controller"

**Respuesta corta**

El attacker no recibe una wallet libre. El owner conserva custodia, puede pausar o revocar, y cualquier intento sigue teniendo que pasar por la policy onchain del vault.

**Respuesta extendida**

Si comprometen al controller, el riesgo existe, pero sigue acotado por las reglas del vault: input tokens permitidos, output tokens permitidos, pairs permitidos, adapter permitido, caps, slippage y cooldown. Si comprometen al operator, tampoco obtiene acceso arbitrario al capital porque el vault sigue validando todo. Nuestro modelo no elimina todo riesgo, pero reduce mucho el radio de dano frente a darle al agente una wallet con poder total.

**Evitar**

"No pasa nada."

## 7. "Que pasa si el agente paga y la ejecucion falla"

**Respuesta corta**

En el MVP, el fee paga el intento de ejecucion del operator, no un resultado garantizado. Somos claros con eso porque lo presentamos como infraestructura de ejecucion, no como promesa de performance.

**Respuesta extendida**

Hay que separar dos capas. Una cosa es el servicio del operator, que cotiza, valida y trata de ejecutar; otra cosa es el resultado de mercado, que puede fallar por slippage, estado onchain o condiciones de red. En esta version, el pago remunera el servicio. Si lo escalaramos a producto comercial, recien ahi agregariamos politicas de refund o success-based pricing.

**Evitar**

"Siempre funciona."

## 8. "Donde esta la parte de IA? Esto parece mas infra que AI"

**Respuesta corta**

Exacto: la novedad no es un chatbot bonito, sino hacer que un agente pueda actuar sobre capital real sin recibir custodia total. La IA esta en la toma de decision; nosotros resolvemos la capa de ejecucion segura.

**Respuesta extendida**

Muchos proyectos muestran al agente pensando, pero dejan abierta la pregunta mas dificil: como ejecuta en el mundo real sin convertirse en un riesgo. Nosotros atacamos justamente esa brecha. El controller puede ser un agente propio o de terceros; nuestra propuesta es la primitive que le permite operar dentro de limites verificables.

**Evitar**

"La IA no importa."

## 9. "Entonces el usuario crea su propio agente dentro del producto"

**Respuesta corta**

No necesariamente. El usuario solo necesita autorizar un controller. Ese controller puede ser propio, de terceros o el demo agent del repo.

**Respuesta extendida**

El producto no es un constructor de bots. Es una capa segura de ejecucion. Nosotros incluimos un agent de referencia para mostrar el flujo end-to-end, pero el valor real es que cualquier controller autorizado pueda integrarse y operar bajo las reglas del vault.

**Evitar**

"Si, cada usuario se arma su propio agente aca."

## 10. "Que esta live hoy y que es roadmap"

**Respuesta corta**

Hoy ya tenemos el flujo principal de `swap-v2`: preview, intent firmado con `executionHash`, fee via `x402`, ejecucion onchain via adapter y receipts. Lo que no vendemos como completo todavia es una red abierta de multiples operators o automatizacion universal de protocolos.

**Respuesta extendida**

Lo importante es ser precisos. El MVP demuestra la tesis central de extremo a extremo: capital en vault, controller autorizado, quote previewed, request firmado, pago programatico y ejecucion onchain bajo policy. Lo que todavia no venderiamos como terminado es todo lo que rodea a una red de escala o a adapters mucho mas amplios, como LP, lending o staking.

**Evitar**

"Ya esta listo para produccion total."

## 11. "Si OKX ya te da la mejor ruta, para que existen ustedes"

**Respuesta corta**

Porque OKX resuelve routing, no custodia ni politica de ejecucion. Nosotros resolvemos la frontera de seguridad entre el agente y el capital.

**Respuesta extendida**

OKX nos da el quote y el path de swap. Nosotros agregamos el vault, la autorizacion del controller, las allowlists de input, output, pair y adapter, el binding del quote con `executionHash`, el fee flow con `x402` y los receipts onchain. No reemplazamos al router; agregamos la capa que faltaba para usarlo con capital delegado.

**Evitar**

"Porque OKX solo no sirve."

## 12. "Por que hacen preview primero en vez de cotizar en execute"

**Respuesta corta**

Porque queremos que el controller firme el paquete exacto de ejecucion. El preview produce el quote, el `minAmountOut` y el `executionHash` que despues quedan firmados.

**Respuesta extendida**

Si cotizaramos recien al final, el controller no estaria aprobando un paquete concreto de ejecucion, sino una intencion mucho mas abierta. El preview nos permite que el agente vea el quote, lo firme y que el vault despues valide que el calldata real coincide con ese `executionHash`. Eso fortalece mucho la historia de seguridad del producto.

**Evitar**

"Es solo una UX mas linda."

## Linea maestra para recordar

Cuando duden, vuelvan siempre a esta frase:

> No estamos vendiendo otro agente DeFi. Estamos vendiendo la capa de ejecucion segura que permite que agentes propios o de terceros hagan swaps sobre capital real sin recibir custodia total.
