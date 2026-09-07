# 076 — Corrige el tema claro del sidebar

## Objetivo
El sidebar (principal y el del editor, `EditorProjectSidebar.tsx`) quedó con colores fijos oscuros desde el ticket 046 (cuando tenía una imagen de fondo siempre oscura) -- esa razón ya no aplica desde que el ticket 073 quitó esa imagen, pero nadie había vuelto a tematizarlo. Marco pidió corregirlo explícitamente para el tema claro (pidió "tema oscuro" primero, se corrigió a mitad de mensaje a "tema claro" -- es el que de verdad se veía roto, con texto oscuro sobre fondo oscuro fijo).

## Criterios de aceptación (TDD)
- Dado el tema claro activo, cuando se mira el sidebar principal (nav + tarjeta de marca), entonces sus colores (fondo, texto, bordes) responden al tema claro -- no quedan fijos en tonos oscuros.
- Dado el tema claro activo, cuando se mira el sidebar del editor (proyecto actual + lista de mobs), entonces ocurre lo mismo (reusa los mismos tokens del sidebar principal).
- Dado cualquiera de los dos sidebars en cualquier tema, cuando se pasa el mouse sobre un item, entonces el hover se ve (no queda invisible por un color inline que le gana a la regla CSS).
- Dado el ícono del item de navegación ACTIVO, cuando se mira, entonces mantiene su color oscuro fijo (vive sobre el acento, que es claro en ambos temas -- mismo criterio ya usado por `.ui-button--primary`).

## Hecho
`Sidebar.tsx`: `SIDEBAR_TEXT`/`SIDEBAR_TEXT_DIM` (exportados, también usados por `EditorProjectSidebar.tsx`) cambiados de strings fijos a `var(--text)`/`var(--text-dim)`; el `background`/`borderRight` del `<nav>` y el `border`/`background` de la tarjeta de marca inferior cambiados de colores fijos a `var(--panel-bg)`/`var(--border)`/`var(--surface-raised)`/`var(--border-strong)`. El color fijo del ícono activo (`#0f171d`, sobre `--accent`) se dejó sin cambios a propósito.

`index.css`: `.ts-nav-item`/`.ts-nav-item--active`, `.ts-sidebar-project-card`, `.ts-sidebar-mob-item`/`--active`, `.ts-sidebar-add-mob` (agregadas en el ticket 073 para poder tener hover, ver ese ticket) convertidas de rgba/hex fijos a tokens de tema, preservando la estructura/transiciones ya existentes.

Verificado en vivo con Claude in Chrome, tema claro y oscuro: sidebar principal y del editor, hover de items en ambos, ícono activo legible sobre el acento en ambos temas. `tsc`/`oxlint`/`vitest` (215)/`build` en verde.
