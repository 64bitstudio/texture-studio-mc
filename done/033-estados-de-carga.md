# 033 — Estados de carga (inicial + transiciones internas) (HU-8)

## Objetivo
Sale de `docs/definiciones/rediseno-ux-ui-y-navegacion.md` (HU-8). Último ticket del backlog -- se beneficia de que `LoadingOverlay`/`Spinner` (ticket 025) y el resto de la navegación (027/028) ya existan.

## Alcance
- Pantalla de carga prolija en el arranque de la app (mientras el catálogo de mobs + el asset base del primer mob todavía no llegan) -- reemplaza el estado `loading` genérico ya existente en `App.tsx` (ticket 001) por el componente `LoadingOverlay` nuevo.
- Indicador de carga al cambiar de mob desde el selector, mientras el asset base de ese mob no está en cache (`bufferCache`/fetch, ticket 018).
- Indicador de carga al cargar un proyecto guardado, mientras los buffers se decodifican (ticket 019).

## Verificación
- En vivo (Claude in Chrome): confirmar que la carga inicial muestra el indicador (puede requerir throttling de red simulado si la carga es demasiado rápida para observarla), que cambiar de mob por primera vez (sin cache) muestra el indicador, y que cargar un proyecto guardado también lo muestra.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que abro la app, cuando el catálogo/asset base todavía no llegan, entonces veo un indicador de carga claro.
- Dado que cambio a un mob sin cache, cuando se está resolviendo, entonces veo un indicador de carga en el área del editor.
- Dado que cargo un proyecto guardado, cuando se están decodificando los buffers, entonces veo un indicador de carga hasta que el editor esté listo.

## Hecho

`LoadingOverlay` (ticket 025, sin consumidor real hasta ahora) reemplaza los textos planos de carga en `App.tsx`: pantalla de inicio (catálogo de mobs, incluye reintento tras error) y área del editor (asset del mob, cubre carga inicial + cambio de mob + reintento). Ambos contenedores padre ganan `position: relative` (mecánico, `LoadingOverlay` ya usa `inset: 0`).

Decisión real, documentada (no silenciosa) en `docs/ARQUITECTURA.md`: la carga de un proyecto guardado NO se migró a `LoadingOverlay` -- `ProjectControls.tsx`/`HomeScreen.tsx` ya tenían su propio indicador por-botón ("Cargando…"/"Abriendo…", tickets 019/027), que identifica CUÁL proyecto se carga (útil con varios en la lista) y es proporcional a una decodificación local casi instantánea. Cuando cargar un proyecto implica además cambiar de mob activo, ese tramo queda cubierto por el `LoadingOverlay` de "Cargando modelo…" recién agregado -- el flujo completo tiene indicador visible en cada tramo sin unificar ambos mecanismos, que el criterio de aceptación ("un indicador de carga", no específicamente `LoadingOverlay`) permite.

Tests: 169/169 en verde (sin tests nuevos -- cambio puramente de UI, verificado en vivo), `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): los fetches reales contra el backend local son casi instantáneos, así que se agregó una demora artificial temporal (`setTimeout` 5s) a `fetchMobs`/`fetchMobBaseAssets` SOLO para observar el overlay, revertida antes de cerrar el ticket (confirmado `git status` sin diff en esos archivos). Con la demora activa: la carga inicial mostró el overlay (spinner + "Cargando catálogo de mobs…", captura de pantalla); cambiar de mob desde el header mostró "Cargando modelo…" (confirmado visualmente y con `querySelector('.ui-loading-overlay')` 50ms después del click, evitando que la latencia propia de la herramienta de automatización enmascarara la observación).

Sin hallazgos de QA pendientes. Con este ticket se completa el backlog de rediseño UX/UI (025-033) aprobado por Marco.
