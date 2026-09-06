# 025 — Sistema de componentes base (`frontend/src/ui/`)

## Objetivo
Sale de `docs/definiciones/rediseno-ux-ui-y-navegacion.md` (Diseño técnico, "Sistema de componentes"). Prerrequisito de HU-4 y de casi todo el resto del backlog 025-033: sin estas primitivas, cada ticket siguiente tendría que inventar su propio markup.

## Alcance
- Módulo nuevo `frontend/src/ui/` con primitivas mínimas (wrappers delgados sobre HTML nativo, sin librería externa):
  - `Button` (variantes: primario, secundario, ícono).
  - `FormField` (label + input/select/número, con `<label>`/`htmlFor` real, nunca solo `placeholder`).
  - `Select` (wrapper de `<select>` nativo, mismo elemento por debajo).
  - `Section`/`Card` (agrupador visual con título, para las tarjetas del grid del ticket 029).
  - `Menu`/`MenuButton` (disclosure pattern accesible: `aria-expanded`, cierre con Escape/click-fuera — usado por el ticket 031).
  - `LoadingOverlay`/`Spinner` (usado por el ticket 033).
- Tokens de diseño (CSS variables): paleta de color, escala tipográfica, escala de espaciado, radios/sombras — declarados en un solo lugar (ej. `frontend/src/ui/tokens.css`), consumidos por todas las primitivas.
- Tema oscuro consistente con la paleta actual (`#2b2d36` del visor 3D como referencia), sin cambiar el look general de la app todavía (ese es el objetivo de tickets posteriores) — este ticket solo construye las piezas.

## Qué NO hacer
- No tocar ningún componente existente del panel todavía (`ColorPicker`, `ResolutionControls`, etc.) — ese es el ticket 026. Este ticket solo crea las primitivas, sin consumidores reales más allá de un ejemplo mínimo de verificación.

## Verificación
- En vivo (Claude in Chrome): montar cada primitiva en una vista de prueba temporal (o directamente en un control real si es trivial) y confirmar que se ve/comporta razonablemente (focus visible, teclado funcional en `Select`/`Menu`).
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado el módulo `frontend/src/ui/`, cuando se importan `Button`/`FormField`/`Select`/`Section`/`Menu`/`LoadingOverlay`, entonces cada uno renderiza correctamente y es accesible por teclado donde aplique (`Select`, `Menu`).
