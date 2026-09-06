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

## Hecho

- `frontend/src/ui/`: `Button`, `FormField`, `Select`, `Section`, `Menu` (+ `menuNavigation.ts` puro y testeado), `LoadingOverlay`, barrel `index.ts`.
- Tokens de diseño agregados al `index.css` existente (espaciado, bordes, radios, sombras, `--transition-fast` con soporte `prefers-reduced-motion`).
- Gotcha real encontrado por oxlint en `Menu.tsx` (`react(set-state-in-effect)`) -- corregido moviendo el reset de `activeIndex` al mismo evento que cierra el menú, en vez de un efecto aparte.
- Consumidor real mínimo (pedido explícitamente por el ticket): `HistoryControls` migrado a `Button`, `ResolutionControls` migrado a `FormField`+`Select` -- verificado en vivo que pintar + deshacer sigue funcionando exactamente igual.
- `Section`/`Menu`/`LoadingOverlay` verificados a nivel de tipos/lint/build; su verificación en vivo interactiva se hace en los tickets 029/031/033 que los integran a un flujo real.
- Test nuevo: `frontend/test/menuNavigation.spec.ts`. `npm run lint`, `npm test`, `npm run build` en verde.

Ver `docs/ARQUITECTURA.md`, "Ticket 025", para el detalle completo.
