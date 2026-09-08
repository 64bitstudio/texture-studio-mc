# 092 — Exportar .bbmodel: geometría, jerarquía y textura

## Objetivo
Construir `exportBlockbench.ts`, que serializa la geometría confirmada (con su jerarquía de huesos como `outliner` anidado) y la textura pintada al formato `.bbmodel` (formato "free", Box UV) -- sin animaciones todavía, ver ticket 093. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 13; HU-13, parcial). Depende de los tickets 084, 086 y 089.

## Criterios de aceptación (TDD)
- Dado un mob con modelo confirmado y textura pintada, cuando exporto, descargo un `.bbmodel` válido (formato "free" con Box UV) con esa geometría, jerarquía y textura embebida.
- Dado ese archivo, cuando lo abro en Blockbench, se ve correctamente y su outliner refleja la jerarquía padre-hijo definida en el editor de modelo.

## Hecho

Implementado en la rama `feature/092-export-bbmodel-geometria-textura`.

- **`frontend/src/exportBlockbench.ts`** (nuevo, puro): `buildBlockbenchModel(geometry, options)` -- formato derivado de `done/080-assets/test-model.bbmodel` (evidencia real, verificada en el juego por Marco, no un supuesto). Sin transformar ejes (`position`/`size` ya están en el mismo espacio que `from`/`to` de Blockbench); mapeo de caras `top/bottom/right/left/front/back` → `up/down/east/west/south/north` con el mismo intercambio de `mirrorX`/`swapFrontBack` de `applyBoxUV.ts`; jerarquía como bone (`outliner`) + cube (`elements`) pareados, rotación siempre en el grupo; `origin` = posición absoluta o `pivot`.
- **`frontend/src/export.ts`**: nueva `exportMobBlockbench(mobId, geometry, entry)` -- aplica jerarquía por defecto si hace falta (mismo criterio que el ticket 090), dispara la descarga.
- **`frontend/src/components/MobEntryCard.tsx`**: nuevo ítem "Exportar .bbmodel" en el menú "⋮", con carga/error propios. Nuevo prop `customGeometry?`.
- **`frontend/src/components/Proyecto.tsx`**: pasa `customGeometry` a cada tarjeta.

**Decisión de alcance señalada explícitamente**: el ticket original (skill `nuevo-ticket`) dejaba abiertas 4 preguntas (pose neutra vs. pivot ya aplicado, granularidad por-mob vs. proyecto, `model_format`, dónde vive el botón) -- la versión final del ticket (`pending/092-...md`) ya las resuelve implícitamente en sus criterios de aceptación (un `.bbmodel` por mob, formato "free" confirmado por evidencia real, geometría tal cual está guardada). La única decisión que SÍ tomé sin especificación explícita: exportar está disponible para CUALQUIER mob (vainilla o confirmado), no solo los que pasaron por "Confirmar modelo" -- mismo criterio ya establecido por el editor de animación (ticket 090), aplicando la jerarquía por defecto automáticamente si hace falta. Señalado aquí en vez de asumido en silencio.

**Tests**: `frontend/test/exportBlockbench.spec.ts` (nuevo, 18 casos: meta/resolution/textura completa, from/to absolutos con jerarquía, mapeo de caras + mirrorX/swapFrontBack, outliner anidado bone+cube, origin/rotation con y sin pivot, múltiples raíces). Suite completa: **380/380 tests en verde**. `tsc -b`, `oxlint`, `npm run build` sin hallazgos.

**Verificación real, contra el archivo descargado de verdad (no solo los tests)**: se exportaron el Zombie (biped simple, vainilla) y la Araña (patas con `pivot`) de un proyecto real en el navegador, y se inspeccionaron los `.bbmodel` descargados con Python: JSON válido en ambos; el elemento `head` del Zombie coincidió BYTE A BYTE (`from`/`to`/las 6 UV de cara) contra el `head` real de `done/080-assets/test-model.bbmodel` (el mismo archivo ya verificado en el juego); la pata `leg1Right` de la Araña quedó como raíz independiente en el outliner (no anidada bajo `thorax`, por el fix de jerarquía+pivot del ticket 090) con `origin`=su `pivot` y `rotation: [0,-45,45]` -- el mismo valor ya verificado de `spiderGeometry.ts`. La textura embebida decodificó como PNG válido. Sin errores en consola.

Sin hallazgos pendientes del gate de QA automático al momento de escribir esto (se revisa de nuevo tras abrir el PR).
