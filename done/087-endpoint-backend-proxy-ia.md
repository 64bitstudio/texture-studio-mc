# 087 — Endpoint backend proxy para llamadas a IA

## Objetivo
Construir un endpoint mínimo en el backend (`POST /api/ai/propose-geometry`, `/propose-color`, `/propose-animation`) que resguarde la API key de Gemini, para que el modo automático de asistencia de IA no la exponga en el navegador -- primera vez que el backend hace algo más que servir estáticos y el catálogo de mobs, cambio de alcance señalado y confirmado explícitamente con Marco. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 8; "Diseño técnico", decisión de seguridad).

## Criterios de aceptación (TDD)
- La API key de Gemini vive únicamente en variables de entorno del backend -- nunca se envía al frontend ni aparece en el bundle del cliente.
- Cada uno de los 3 endpoints recibe el payload correspondiente (geometría base + descripción / atlas + descripción / preset + descripción) y devuelve la respuesta de Gemini ya parseada, o un error claro y tipado.
- Tests de integración cubren el caso de éxito y el caso de cuota excedida/error de la API externa.

## Hecho

Implementado tal como se planeó, con una precisión sobre el payload: los 3 endpoints comparten un contrato genérico `{ prompt: string }` -- el prompt completo (geometría/atlas/preset + descripción, ya armado) lo construye el frontend en los tickets 088/089/091 (mismo texto que usaría el modo puente manual), no este backend. Este ticket solo construye el mecanismo de proxy/reintentos, reusable por los 3.

- `services/aiAssist.ts`: `requestAiJsonProposal(prompt, options?)` -- llama a Gemini con `responseMimeType: "application/json"`, reintentos con backoff exponencial (hasta 3 intentos, ante 429/500/502/503/504 o fallos de red -- hallazgo del spike 081), sin reintentar errores no transitorios (prompt vacío, API key ausente, 4xx que no sea 429).
- `routes/aiAssist.ts`: las 3 rutas, log server-side (`console.warn`) antes de responder al cliente.
- `app.ts`: `express.json({ limit: '256kb' })` -- primera vez que este backend parsea un body.
- **Hallazgo señalado explícitamente, no silencioso**: este backend antes no tenía secretos propios (`Jenkinsfile` tiene `skipVaultSecrets: true`, ver ese comentario). Con `GEMINI_API_KEY` eso deja de ser cierto. Actualicé `deploy/.env.{dev,qa,prod}.example` documentando la variable, pero **NO cambié `skipVaultSecrets` en el Jenkinsfile** -- migrar el secreto a Vault (crear `secret/texture-studio-mc/<env>`) es trabajo de DevOps que requiere acceso a Vault, fuera del alcance de este ticket. Mientras tanto, un despliegue real necesita que alguien con acceso a la VM puebla la variable a mano en el `.env` correspondiente para que el modo automático de IA funcione (el resto de la app sigue funcionando sin ella).

**Tests**: 13 nuevos en `test/aiAssist.spec.ts` -- unit del servicio con `delayFn` inyectado (éxito al primer intento, recuperación en el segundo ante un 503, agota los 3 intentos ante 429 persistente, NO reintenta ante 404, JSON inválido de la IA se trata como error) + integración vía `supertest` contra las 3 rutas (éxito parametrizado con `it.each`, 400 sin prompt, 500 sin API key, y el caso de cuota excedida agotando reintentos con `AI_ASSIST_RETRY_BASE_MS=1` para no esperar segundos reales). Suite completa backend 30/30, lint y build limpios. `docs/API.md` y `docs/COMPONENTES.md` actualizados.

No aplica revisión visual (sin UI). Postman: no se agregó a la colección porque estos endpoints necesitan una `GEMINI_API_KEY` real para responder algo útil (una colección compartida con una key de ejemplo inválida solo generaría confusión) -- se agrega cuando el ticket 088 los consuma desde el frontend real y haya un ejemplo con el que valga la pena probar a mano.
