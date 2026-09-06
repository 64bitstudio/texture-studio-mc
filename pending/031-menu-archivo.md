# 031 — Menú unificado de Archivo (importar/exportar/proyectos) (HU-6)

## Objetivo
Sale de `docs/definiciones/rediseno-ux-ui-y-navegacion.md` (HU-6). Depende del ticket 025 (`Menu`/`MenuButton`).

## Alcance
- Botón "Archivo" con menú desplegable (`Menu`/`MenuButton` del ticket 025) que agrupa: Importar textura, Pegar imagen, Exportar PNG, Exportar pack `.zip`, Guardar proyecto, Cargar proyecto, Eliminar proyecto.
- Cada opción del menú ejecuta el mismo comportamiento ya verificado de esa acción (`ImportTextureControl`, `PasteImageControls`, `ExportControls`, `ProjectControls` — sin cambios de lógica, solo de ubicación en la UI).
- Los controles migrados dejan de ocupar espacio permanente en el panel (se accede solo vía el menú).

## Verificación
- En vivo (Claude in Chrome): abrir el menú, ejecutar cada acción (importar, pegar, exportar PNG, exportar zip, guardar, cargar, eliminar) y confirmar que cada una se comporta exactamente igual que antes de este ticket.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado el editor, cuando abro el menú "Archivo", entonces veo las 7 acciones agrupadas.
- Dado que elijo cualquier acción del menú, entonces se ejecuta el mismo comportamiento ya existente sin cambios de lógica.
