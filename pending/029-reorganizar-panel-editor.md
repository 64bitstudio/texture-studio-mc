# 029 — Reorganización del panel del editor en grid + visor acotado a 400px (HU-3)

## Objetivo
Sale de `docs/definiciones/rediseno-ux-ui-y-navegacion.md` (HU-3, Diseño técnico "Layout del panel: CSS Grid con auto-fit"). Depende de los tickets 025/026 (primitivas y controles ya migrados, para que el grid tenga piezas consistentes que acomodar).

## Alcance
- Visor 3D (`Viewer3D.tsx`, sin cambios internos) acotado a 400px de ancho máximo en el layout del editor.
- Panel de controles reorganizado: secciones (Color, Vista, Simetría, Resolución, Aislar parte, Archivo) agrupadas en tarjetas (`Section`/`Card` del ticket 025) dispuestas en `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` (o equivalente), no en una sola columna apilada.
- Responsive: en ventanas angostas, el grid colapsa a una columna sin romper ningún control (mismo criterio de "pixeles siempre cuadrados" del ticket 010 — no debe reintroducir la distorsión que ese ticket corrigió).

## Verificación
- En vivo (Claude in Chrome): confirmar que el visor nunca excede 400px de ancho en ventana normal, que el panel se ve en grid de 2-3 columnas, y que angostar la ventana colapsa a una columna sin romper el aspecto cuadrado de los píxeles del editor 2D.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado el editor en una ventana >1000px, cuando se renderiza, entonces el visor 3D nunca excede 400px de ancho.
- Dado el panel de controles, cuando se renderiza, entonces sus secciones están agrupadas en tarjetas en un grid de 2-3 columnas.
- Dado que la ventana se angosta, cuando no cabe el grid, entonces colapsa a una columna sin romper ningún control.
