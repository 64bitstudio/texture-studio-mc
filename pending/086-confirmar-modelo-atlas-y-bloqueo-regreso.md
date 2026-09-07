# 086 — Confirmar modelo, generar atlas UV y bloquear regreso

## Objetivo
Cerrar la Etapa 2: al confirmar el modelo, generar su atlas de textura (usando el ticket 085) y transicionar al editor de textura con la geometría de esa versión bloqueada. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 7; HU-6). Depende de los tickets 083, 084 y 085.

## Criterios de aceptación (TDD)
- Dado un modelo con al menos una caja, cuando presiono "Confirmar modelo", la app calcula el layout UV sin traslapes y me lleva al editor de textura.
- Dado que ya confirmé el modelo, cuando intento volver al editor de modelo para ese mismo mob, la opción no está disponible -- el mensaje explica que para cambiar geometría debo duplicar el proyecto.

## Hecho
