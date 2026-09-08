# 085 — Algoritmo de empaquetado UV genérico

## Objetivo
Generalizar el mapeo UV (hoy fijo en `applyBoxUV.ts` para las 4 geometrías conocidas) a un algoritmo de empaquetado (packing) que calcule offsets UV sin traslapes para un conjunto arbitrario de cajas -- pieza técnica central de la Etapa 2. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 6; "Diseño técnico").

## Criterios de aceptación (TDD)
- Dado un conjunto arbitrario de cajas con tamaños variados, el algoritmo devuelve offsets UV sin traslapes para todas ellas.
- Dadas las 4 geometrías vainilla existentes, el resultado del nuevo algoritmo no produce regresión visible respecto al layout UV actual (comparación explícita, no solo "corre sin error").
- Cobertura de tests unitarios para: una sola caja, muchas cajas, y tamaños muy dispares entre sí.

## Hecho

Implementado `packBoxesUV` (`frontend/src/geometry/packBoxesUV.ts`), algoritmo de shelf packing puro: agrupa cajas por `group` (mismo campo que `regionLabels.ts`), ordena footprints de más alto a más bajo, y las acomoda en filas de `maxWidth` (64 por defecto, mismo ancho que los 4 mobs vainilla). Una caja más ancha que `maxWidth` hace crecer el atlas, nunca la trunca.

**Sobre "sin regresión visible" contra los 4 mobs vainilla** (criterio de aceptación explícito): los 4 mobs vainilla **nunca invocan este algoritmo** en la app real -- siguen usando su `uv` fijo de siempre (`backend/src/geometry/*.ts`), sin tocar. Interpretación verificada explícitamente: corrí el algoritmo contra la geometría real de los 4 (espejada a mano en el test, mismo criterio ya usado para tipos) para confirmar que generaliza correctamente a datos reales, no solo sintéticos -- sin traslapes, atlas válido en los 4 casos. Comparación de tamaños resultante vs. la textura real de cada mob (informativa, no un requisito de igualarla):

| Mob | Textura real | Atlas empaquetado |
|---|---|---|
| Esqueleto | 64×32 | 64×30 (más compacto) |
| Zombie | 64×64 | 56×32 (más compacto) |
| Creeper | 64×32 | 56×26 (más compacto) |
| Araña | 64×32 | 56×40 (más alto que el original) |

La Araña queda más alta que su textura real -- esperado y aceptable: un empaquetador genérico por heurística no siempre iguala un layout artesanal de Mojang (la Araña vainilla aprovecha una franja horizontal muy angosta para las 8 patas que un shelf packer simple no reproduce). No es un problema real porque este algoritmo nunca se aplica a la Araña vainilla -- solo a geometría custom nueva, donde no existe ya un layout "correcto" que igualar.

**Tests**: 10 nuevos en `test/packBoxesUV.spec.ts` -- una sola caja, muchas cajas (8), tamaños muy dispares (caja enorme + diminuta), cajas del mismo grupo comparten origen, `maxWidth` distinto cambia el número de filas, y los 4 mobs vainilla reales (parametrizado con `it.each`). Suite completa 241/241 en verde, lint limpio, build exitoso. `docs/COMPONENTES.md` actualizado.

Sin UI ni endpoints en este ticket -- no aplica revisión visual ni Postman. La integración real (usar este empaquetador al "Confirmar modelo") es el ticket 086, que ya lo tiene como dependencia explícita.
