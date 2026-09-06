# 032 — Iconografía y transiciones (HU-7)

## Objetivo
Sale de `docs/definiciones/rediseno-ux-ui-y-navegacion.md` (HU-7). Se beneficia de que el resto del panel (025-031) ya esté con la nueva estructura de componentes antes de pulir encima.

## Alcance
- Íconos reconocibles junto al texto (nunca solo ícono, por accesibilidad) en los botones de acción principal: Deshacer, Rehacer, Borrar, Archivo, Guardar, Volver al inicio, y los que aplique del resto del panel.
- Transiciones cortas (~150-250ms) en cambios de estado visual: abrir/cerrar menú de Archivo, cambiar de mob, activar aislar-parte/modo borrar — respetando `prefers-reduced-motion`.

## Verificación
- En vivo (Claude in Chrome): confirmar visualmente que los botones principales tienen ícono + texto, y que las transiciones se sienten suaves (no instantáneas ni exageradamente lentas). Confirmar que con `prefers-reduced-motion: reduce` las transiciones se omiten/reducen.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado cualquier botón de acción principal, cuando se renderiza, entonces incluye ícono + texto.
- Dado un cambio de estado visual (menú, cambio de mob, activar un modo), cuando ocurre, entonces se anima con una transición corta, respetando `prefers-reduced-motion`.
