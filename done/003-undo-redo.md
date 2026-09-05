# 003 — Undo / redo

## Objetivo
Sale de `docs/definiciones/editor-3d-texturas-esqueleto.md` (HU-4). Historial de deshacer/rehacer sobre las acciones de pintura del ticket 002.

## Alcance
- Pila de historial de cambios sobre el `TextureBuffer` (ticket 002).
- Atajos de teclado estándar (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) además de botones en UI.

## Criterios de aceptación
Ver HU-4 completa en la definición.

## Hecho
Implementado por el agente `fullstack-dev` (PR [#7](https://github.com/64bitstudio/texture-studio-mc/pull/7)). CI de Jenkins en verde, sin hallazgos del gate de QA automático.

- `PaintHistory` (`frontend/src/history.ts`): historial de undo/redo puro, separado de `TextureBuffer` a propósito (no le agrega conocimiento de UI/historial). Unidad de historial = un trazo completo (`pointerdown`→`pointerup`/`pointercancel`), no cada pixel individual.
- `HistoryControls`: botones "Deshacer"/"Rehacer", deshabilitados cuando no aplica.
- Atajos de teclado: Ctrl/Cmd+Z (deshacer), Ctrl/Cmd+Shift+Z y Ctrl+Y (rehacer), a nivel de `window`.
- Pintar un trazo nuevo tras un undo descarta el redo pendiente (comportamiento estándar).
- 8 tests nuevos de historial (26 en total en frontend), lint y build en verde.
- **Verificado en vivo contra el deploy real de DEV** (el orquestador repitió la verificación tras el merge, no solo local): pintar un trazo → "Deshacer" lo revierte en la cuadrícula → "Rehacer" lo restaura → estado de los botones (habilitado/deshabilitado) correcto en cada paso.
- Pendiente, explícitamente fuera de este ticket: simetría/zoom-grid (004), importar/pegar imagen (005), exportar (006).
