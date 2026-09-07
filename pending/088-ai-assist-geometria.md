# 088 — AIAssistProvider base + asistencia de IA para geometría

## Objetivo
Construir la interfaz `AIAssistProvider` con sus dos implementaciones iniciales (`ManualBridgeProvider`, `FreeApiProvider`) aplicadas a la Etapa 1: proponer geometría a partir de una descripción de texto, en modo puente manual (copiar/pegar) y modo automático (API gratuita). Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 9; HU-4, HU-5). Depende de los tickets 083 (editor de modelo) y 087 (endpoint backend).

## Criterios de aceptación (TDD)
- Dado que escribo una descripción y elijo "Generar con IA (copiar prompt)", la app arma un prompt con la geometría base serializada + mi descripción, listo para copiar (HU-4).
- Dado que pego la respuesta JSON en "Importar propuesta de geometría", la app la valida contra el esquema esperado y, si es válida, la carga en el editor para revisión/edición; si es inválida, muestra un error inline sin romper el modelo actual (HU-4).
- Dado que elijo "Generar con IA (automático)", la app llama al endpoint del ticket 087 y carga la propuesta igual que en el modo manual (HU-5).
- Dado que la llamada automática falla o excede cuota, veo un error claro y la opción de usar el modo puente manual como respaldo (HU-5).

## Hecho
