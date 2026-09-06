# 054 — Íconos SVG en el menú ⋮ de "Mis proyectos" + botón Editar menos redondeado

## Objetivo
Corrección visual puntual sobre el ticket 053 (rediseño de "Mis
proyectos"): el menú "⋮" de cada tarjeta usa emojis (✏️🗂️📦🗑) para
Renombrar/Duplicar/Exportar/Eliminar -- deben ser SVG dibujados a mano,
mismo criterio ya establecido en el ticket 046 ("SVG dibujados a mano,
sin librería externa"). Además, el botón "Editar" se ve demasiado
redondeado -- reducir su `border-radius`.

Pedido textual de Marco: "esta bien pero al hacer click en el boton de
los 3 puntitos salen iconos de los cuales no quiero que sean emogis, tu
haz los svg, el boton de editar debe estar menos redondeado".

## Alcance
- `frontend/src/ui/icons.tsx`: 3 íconos nuevos (`IconDuplicate`,
  `IconExport`, `IconTrash`) -- `IconPencil` (ticket 053) se reusa para
  "Renombrar".
- `frontend/src/components/ProjectCard.tsx`: reemplaza los 4 `<span
  aria-hidden>` con emoji del menú ⋮ por los íconos SVG; reduce el
  `borderRadius` del botón "Editar" (`var(--radius-lg)` →
  `var(--radius-md)`).

## Qué NO hace este ticket
- No toca el menú "Archivo" de `Editor.tsx` (usa emoji 📁 también, pero
  Marco no lo mencionó -- fuera de alcance hasta que lo pida).
- No cambia ningún comportamiento -- 100% visual.

## Criterios de aceptación (TDD)
- Dado que abro el menú ⋮ de una tarjeta, cuando lo veo, entonces
  Renombrar/Duplicar/Exportar/Eliminar muestran íconos SVG (mismo estilo
  `LineIcon` que el resto de `ui/icons.tsx`), sin ningún emoji.
- Dado que veo el botón "Editar" de una tarjeta, entonces sus esquinas
  están notablemente menos redondeadas que antes.
- Verificación visual en vivo (Claude in Chrome), dark y light theme.

## Hecho

Implementado tal como se pidió, ambos criterios de aceptación cumplidos
y verificados en vivo (Claude in Chrome, grid y lista, dark y light
theme, sin errores de consola).

- `frontend/src/ui/icons.tsx`: `IconDuplicate`, `IconExport`, `IconTrash`
  (nuevos, hand-drawn, mismo criterio del ticket 046) -- `IconPencil`
  (ticket 053) se reusa para "Renombrar".
- `frontend/src/components/ProjectCard.tsx`: menú "⋮" sin emoji;
  `borderRadius` del botón "Editar" de `var(--radius-lg)` (14px) a
  `var(--radius-md)` (8px).

Sin cambios de comportamiento -- `npx tsc --noEmit`, `npm run lint`,
`npm test` (201, sin tests nuevos), `npm run build` en verde.
