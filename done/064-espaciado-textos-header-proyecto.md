# 064 — Más espacio entre los 3 textos del header, ícono de descripción alineado con su texto

## Objetivo
Corrección puntual de Marco sobre el header de "Proyecto" (ticket 063):
"los 3 textos hazlos que tengan mas espacio entre si, y el texto del
ultimo alinealo con su boton de edicion".

## Alcance
- `components/Proyecto.tsx`:
  - Más espacio vertical entre los 3 textos del header (título, línea
    "N mobs · Última modificación: fecha", descripción) -- `gap` del
    contenedor de 6px a 12px.
  - El ícono de editar descripción (`icon-plain`) alineado con el
    texto de la descripción -- `alignItems: 'center'` en vez de
    `'flex-start'` en esa fila (mismo criterio que ya usaba la fila del
    título).

## Criterios de aceptación (TDD)
- Dado el header de "Proyecto", cuando lo veo, entonces hay separación
  vertical clara entre el título, la línea de resumen y la descripción
  (no se ven apretados entre sí).
- Dado el ícono de editar descripción, cuando lo veo junto a una
  descripción de una sola línea, entonces está alineado verticalmente
  con el texto (no desplazado hacia abajo).
- Verificación visual en vivo (Claude in Chrome), dark y light theme.

## Hecho

- `Proyecto.tsx`: `gap` del contenedor de los 3 textos de 6px a 12px;
  fila de la descripción cambiada de `alignItems: 'flex-start'` a
  `'center'` (mismo criterio que la fila del título, que ya usaba
  `'center'`).
- Verificación: `npx tsc --noEmit`, `npx oxlint`, `npm run build`
  limpios; `npx vitest run` -- 215/215 tests en verde (ticket 100%
  visual/estilo, sin lógica nueva). Verificación visual en vivo (Claude
  in Chrome) contra el proyecto real "Set Nether": separación clara
  entre los 3 textos, ícono de descripción alineado con su línea de
  texto -- dark y light theme, sin errores de consola.
