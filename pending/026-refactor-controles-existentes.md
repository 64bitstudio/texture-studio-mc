# 026 — Refactor de los controles existentes al sistema de componentes (HU-4)

## Objetivo
Sale de `docs/definiciones/rediseno-ux-ui-y-navegacion.md` (HU-4). Depende del ticket 025 (primitivas ya construidas).

## Alcance
Migrar los ~15 controles existentes del panel lateral a las primitivas de `frontend/src/ui/` (cambio de MARKUP/estilo únicamente, cero cambio de lógica de negocio — `Editor.tsx` sigue siendo dueño de todo el estado real):
- `ColorPicker`, `HistoryControls`, `SymmetryControls`, `ResolutionControls`, `ZoomControls`, `GridToggle`, `PartIsolationControls`, `ImportTextureControl`, `PasteImageControls`, `ExportControls`, `ProjectControls`, `MobSelector`.

## Qué NO hacer
- No cambiar ningún comportamiento funcional de ningún control durante el refactor — si algo parece que "de paso" podría mejorarse funcionalmente, se documenta como hallazgo y NO se toca en este ticket (alcance estrictamente visual/estructural).
- No hacerlo en un solo commit gigante sin verificación intermedia — verificar en vivo grupos de controles conforme se migran, no todo al final.

## Verificación
- En vivo (Claude in Chrome), para cada control migrado: confirmar que su comportamiento funcional es idéntico a antes del refactor (pintar, deshacer/rehacer, cambiar resolución, simetría, aislar parte, importar/pegar imagen, exportar, guardar/cargar proyecto, seleccionar mob).
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado cualquier control del panel ya migrado, cuando se usa, entonces su comportamiento es exactamente el mismo que antes de este ticket — solo cambia su estructura visual/HTML.
