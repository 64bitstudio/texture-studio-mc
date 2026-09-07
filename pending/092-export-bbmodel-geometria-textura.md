# 092 — Exportar .bbmodel: geometría, jerarquía y textura

## Objetivo
Construir `exportBlockbench.ts`, que serializa la geometría confirmada (con su jerarquía de huesos como `outliner` anidado) y la textura pintada al formato `.bbmodel` (formato "free", Box UV) -- sin animaciones todavía, ver ticket 093. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 13; HU-13, parcial). Depende de los tickets 084, 086 y 089.

## Criterios de aceptación (TDD)
- Dado un mob con modelo confirmado y textura pintada, cuando exporto, descargo un `.bbmodel` válido (formato "free" con Box UV) con esa geometría, jerarquía y textura embebida.
- Dado ese archivo, cuando lo abro en Blockbench, se ve correctamente y su outliner refleja la jerarquía padre-hijo definida en el editor de modelo.

## Hecho
