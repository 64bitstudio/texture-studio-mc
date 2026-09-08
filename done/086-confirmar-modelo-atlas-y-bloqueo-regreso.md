# 086 — Confirmar modelo, generar atlas UV y bloquear regreso

## Objetivo
Cerrar la Etapa 2: al confirmar el modelo, generar su atlas de textura (usando el ticket 085) y transicionar al editor de textura con la geometría de esa versión bloqueada. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 7; HU-6). Depende de los tickets 083, 084 y 085.

## Criterios de aceptación (TDD)
- Dado un modelo con al menos una caja, cuando presiono "Confirmar modelo", la app calcula el layout UV sin traslapes y me lleva al editor de textura.
- Dado que ya confirmé el modelo, cuando intento volver al editor de modelo para ese mismo mob, la opción no está disponible -- el mensaje explica que para cambiar geometría debo duplicar el proyecto.

## Hecho

Implementado con una precisión de alcance sobre la UI: el "Continuar" del ticket 083 se separó en dos botones -- "Guardar borrador" (sin atlas, reabrile) y "Confirmar modelo" (nuevo, este ticket). También se reescribió cómo el editor de textura obtiene sus datos para un mob confirmado (hallazgo real, ver abajo).

- `geometry/packBoxesUV.ts`: `applyPackedAtlas`/`confirmModelGeometry`, 4 tests nuevos.
- `projectStorage.ts`: `updateMobGeometry` ensanchada para aceptar `pngDataUrl`/`resolution` además de `geometryStatus`/`customGeometry`.
- `projectSnapshot.ts`: `buildConfirmedMobEntry` (genera el PNG en blanco del tamaño del atlas).
- `ModelEditor3D.tsx`: botón "Confirmar modelo" -- calcula el atlas y entrega la geometría final.
- `MobEntryCard.tsx`/`Proyecto.tsx`: "Editar modelo 3D" deshabilitado + mensaje cuando `geometryStatus === 'confirmado'`; `App.tsx#handleEditModel` lo rechaza también como defensa en profundidad.

**Hallazgo real, señalado explícitamente (no oculto)**: el editor de textura (`'editor'`, Etapa 3) SIEMPRE fetcheaba el catálogo vainilla del backend para cualquier mob, sin ninguna noción de geometría custom -- de haber dejado esto así, "Confirmar modelo" hubiera navegado a un editor que igual mostraría la Araña vainilla de 6 cajas, ignorando por completo el atlas recién calculado. Corregido: `confirmedMobEntry`/`effectiveAssetState` se derivan durante el render (mismo criterio ya usado para `selectedMobId`, evita el patrón `react(set-state-in-effect)` que ya había aparecido en el ticket 084) -- para un mob `'confirmado'`, se usa la geometría/PNG guardados localmente; el efecto de fetch se salta el fetch en ese caso.

**Tests corridos de verdad, todos en verde**: frontend 279/279 (`npx vitest run`), lint limpio, `tsc -b` y `vite build` exitosos.

**Revisión visual en vivo** (regla del equipo): levanté los servidores y probé con Claude in Chrome sobre un proyecto con Araña real -- "Confirmar modelo" generó un atlas de 56×40 (visible en el editor de textura como "TEXTURA (56×40)", muy distinto del 64×32 vainilla) y navegó directo ahí; al volver a "Proyecto", el menú mostró "Editar modelo 3D" atenuado con el mensaje "Modelo confirmado -- duplica el proyecto para cambiar la geometría" debajo, y un click real sobre ese botón deshabilitado no navegó a ningún lado -- ambos criterios de aceptación verificados de punta a punta en el navegador real.

No aplica Postman (sin endpoints nuevos).
