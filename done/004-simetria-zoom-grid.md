# 004 — Simetría de pintura + zoom/grid ajustable

## Objetivo
Sale de `docs/definiciones/editor-3d-texturas-esqueleto.md` (HU-6, HU-7). Modo de simetría (eje configurable) y controles de zoom/tamaño de cuadrícula en el editor del ticket 002.

## Alcance
- Toggle de simetría + selección de eje, con mapeo de pixel → contraparte simétrica.
- Zoom del editor sin interpolación/blur (pixel-perfect) y grid ajustable.

## Criterios de aceptación
Ver HU-6 y HU-7 completas en la definición.

## Hecho
Implementado por el agente `fullstack-dev` (PR [#9](https://github.com/64bitstudio/texture-studio-mc/pull/9)). CI de Jenkins en verde, sin hallazgos del gate de QA automático.

- `symmetry.ts`: simetría horizontal (único eje ofrecido, con justificación geométrica documentada en `docs/ARQUITECTURA.md` — vertical solo sería coherente en la cabeza, no en torso/brazo/pierna) dentro de cada una de las 4 cajas UV distintas del Esqueleto, derivadas de la geometría real del backend (no hardcodeadas).
- `zoom.ts` + `ZoomControls`: 400%–4000%, botones +/- y Ctrl/Cmd+rueda, pixel-perfect en todo el rango (sin blur).
- `GridToggle`: mostrar/ocultar cuadrícula en un canvas overlay separado.
- Integración con el historial del ticket 003: un trazo simétrico (pixel + su espejo) queda como una sola unidad de undo/redo.
- 6 tests nuevos de simetría, lint y build en verde.
- **Verificado en vivo contra el deploy real de DEV** (el orquestador repitió la verificación tras el merge): pintar con simetría activa pinta el pixel y su espejo dentro de la caja de la cabeza; un solo "Deshacer" revierte ambos; zoom +/- funciona nítido hasta 1400%+; el toggle de cuadrícula oculta/muestra las líneas correctamente.
- Pendiente, explícitamente fuera de este ticket: importar/pegar imagen (005), exportar (006).
