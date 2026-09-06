# 059 — Íconos en la info de la tarjeta de mob + layout imagen-izquierda/detalle-derecha

## Objetivo
Marco pidió dos ajustes puntuales sobre la tarjeta de mob de
`Proyecto.tsx` (ticket 057/058): (1) la lista de info (archivo/
dimensiones/escala/modelo) hoy es texto plano, sin íconos -- la imagen
de referencia sí los muestra; (2) el layout de la tarjeta en modo grid
debe tener la miniatura 2D del lado IZQUIERDO y el detalle (nombre +
info) del lado DERECHO, en vez de nombre arriba + imagen grande abajo
centrada.

## Alcance
- `ui/icons.tsx`: 4 íconos nuevos hand-drawn (mismo criterio del ticket
  046, sin librería externa) -- `IconDocument` (archivo), `IconMaximize`
  (dimensiones), `IconScale` (escala), `IconModel` (modelo, wireframe --
  distinto de `IconCube`, que es la versión rellena de colores fijos ya
  usada como ícono de marca).
- `components/MobEntryCard.tsx`:
  - Cada línea de la info (`archivo.png`, `NxN px`, `Escala: xN`,
    `Modelo: X`) gana su ícono correspondiente a la izquierda, mismo
    patrón visual que el resto de la app (ícono + texto).
  - Layout de la tarjeta en modo GRID: miniatura 2D a la izquierda,
    columna de nombre+menú "⋮"+info a la derecha (en vez de nombre+menú
    arriba y la miniatura grande centrada debajo). El modo LISTA ya
    tenía este orden (miniatura izquierda, info derecha) -- sin cambios
    ahí salvo agregar los íconos.

## Qué NO hace este ticket
- No cambia ningún comportamiento (búsqueda, editar, eliminar, vista
  previa) -- 100% visual.
- No toca `Editor.tsx`.

## Criterios de aceptación (TDD)
- Dado una tarjeta de mob (grid o lista), cuando veo su info, entonces
  cada línea (archivo/dimensiones/escala/modelo) tiene un ícono SVG a
  la izquierda, sin emoji.
- Dado una tarjeta de mob en modo grid, cuando la veo, entonces la
  miniatura 2D está del lado izquierdo y el nombre+menú+info del lado
  derecho.
- Verificación visual en vivo (Claude in Chrome), dark y light theme.

## Hecho

Implementado tal como se pidió. Ambos criterios de aceptación
cumplidos y verificados en vivo (Claude in Chrome, grid y lista, dark y
light theme, sin errores de consola).

- `frontend/src/ui/icons.tsx`: `IconDocument`, `IconMaximize`,
  `IconScale`, `IconModel` (nuevos, hand-drawn).
- `frontend/src/components/MobEntryCard.tsx`: info con íconos; layout
  grid invertido (miniatura izquierda 96px, detalle derecha).

Sin cambios de comportamiento -- `npx tsc --noEmit`, `npm run lint`,
`npm test` (220, sin tests nuevos), `npm run build` en verde.
