# 069 — Tarjeta de mob (modo grid): nombre+menú arriba, imagen a todo el ancho debajo

## Objetivo
Marco, con imagen de referencia: "ahora el texto de la card debe estar
hasta arriba y centrado, con hasta arriba me refiero que debe estar
arriba de la imagen, igual el boton de 3 puntos debe estar arriba pero
hasta la derecha, los textos dentro de la card deven verse mas
espaciados".

## Alcance
- `components/MobEntryCard.tsx` (modo grid únicamente -- modo lista
  sin cambios, ticket 068):
  - El nombre + el menú "⋮" pasan a ser la fila de hasta arriba de la
    tarjeta (antes: miniatura a la izquierda, nombre+menú+info a la
    derecha, ticket 059) -- nombre a la izquierda, menú a la derecha,
    ambos centrados verticalmente en su fila.
  - La miniatura pasa de un cuadro fijo de 160px a un lado del nombre,
    a ocupar TODO el ancho de la tarjeta, debajo de la fila de
    nombre+menú.
  - La info (archivo/dimensiones/escala/modelo) va debajo de la
    miniatura, a todo el ancho.
  - Más espacio entre las secciones de la tarjeta (`gap` de 14 a 18).

## Criterios de aceptación (TDD)
- Dado el modo grid, cuando veo una tarjeta de mob, entonces el nombre
  y el botón "⋮" están en la fila de hasta arriba (nombre a la
  izquierda, menú a la derecha), la miniatura ocupa todo el ancho
  debajo de esa fila, y la info va debajo de la miniatura.
- Dado el modo lista, cuando veo una tarjeta de mob, entonces sigue
  igual que antes (ticket 068) -- sin cambios.
- Verificación visual en vivo (Claude in Chrome) contra la imagen de
  referencia de Marco, dark y light theme.

## Hecho

- `MobEntryCard.tsx`: `thumb` ahora se construye distinto por modo
  (`isList`) -- 40x40 en lista (sin cambio), `width: '100%', height:
  200` en grid (antes 160x160 fijo). El `return` de modo grid se
  reescribió: fila nombre+menú (`alignItems:'center',
  justifyContent:'space-between'`) como primer hijo del `<li>`, luego
  `{thumb}`, luego `{info}`, luego los botones -- ya no hay una fila
  horizontal miniatura-izquierda/detalle-derecha. `gap` del `<li>` de
  14 a 18.
- Verificación: `npx tsc --noEmit`, `npx oxlint`, `npm run build`
  limpios; `npx vitest run` -- 215/215 tests en verde (ticket 100%
  visual, sin lógica nueva). Verificación visual en vivo (Claude in
  Chrome) contra el proyecto real "Set Nether", comparado directamente
  contra la imagen de referencia de Marco -- coincide en estructura,
  modo lista confirmado sin cambios -- dark y light theme, sin errores
  de consola.
