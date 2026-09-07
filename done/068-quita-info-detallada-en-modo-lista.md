# 068 — Quita el bloque de info detallada en modo lista (deforma la fila)

## Objetivo
Marco, con captura de pantalla: "al mostrar en modo lista quita el
texto que detalla la textura pues deforma el elemento (me refiero a
los textos de spider.png, la resolucion, escala y modelo, solo deja el
nombre)".

## Alcance
- `components/MobEntryCard.tsx`: en modo lista, ya no se muestra el
  bloque de info (archivo/dimensiones/escala/modelo) -- solo el
  nombre del mob. El modo grid NO cambia (ahí sí hay espacio y el
  bloque de info sigue siendo útil).

## Criterios de aceptación (TDD)
- Dado el modo lista, cuando veo una fila de mob, entonces solo
  muestra el nombre (sin archivo/dimensiones/escala/modelo) y la fila
  no se ve deformada.
- Dado el modo grid, cuando veo una tarjeta de mob, entonces el bloque
  de info sigue mostrándose igual que antes.
- Verificación visual en vivo (Claude in Chrome), dark y light theme.

## Hecho

- `MobEntryCard.tsx`: en el `return` de modo lista, se quita `{info}`
  y el `<div>` que lo envolvía junto al nombre -- el nombre pasa a ser
  un `<span>` directo con `flex: 1` (ocupa el espacio que antes
  compartía con el bloque de info).
- Verificación: `npx tsc --noEmit`, `npx oxlint`, `npm run build`
  limpios; `npx vitest run` -- 215/215 tests en verde (ticket 100%
  visual, sin lógica nueva). Verificación visual en vivo (Claude in
  Chrome) contra el proyecto real "Set Nether": modo lista muestra solo
  el nombre por fila, sin deformación; modo grid sin cambios -- dark
  theme, sin errores de consola.
