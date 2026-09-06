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
