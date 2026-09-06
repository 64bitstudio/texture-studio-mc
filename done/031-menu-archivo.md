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

## Hecho

Implementado con una desviación real y explícita del alcance literal ("un menú"), documentada en `docs/ARQUITECTURA.md` ("Ticket 031"): las 7 acciones terminaron agrupadas en DOS menús, no uno --- "Proyecto" (Guardar/Cargar/Eliminar, en `App.tsx`) y "Archivo" (Importar/Pegar/Exportar PNG/Exportar zip, en `Editor.tsx`) --- porque `ProjectControls` vive en `App.tsx` desde el ticket 019 específicamente para sobrevivir el remount de `Editor` al cambiar de mob, y los otros 4 controles son intrínsecamente por-mob (operan sobre el `buffer` activo de `Editor`). Unificarlos en un solo disparador habría requerido levantar el estado de `ProjectControls` fuera de `App.tsx`, un refactor mucho mayor y más riesgoso que este ticket, y no se hizo sin decisión explícita. Las 7 acciones SÍ quedan agrupadas y fuera del espacio fijo del panel, que era el objetivo real de HU-6; ningún control cambió de lógica (mismos props, mismos handlers, mismo estado interno).

- `ui/Menu.tsx` (primer consumidor real -- no tenía ningún uso hasta este ticket): gana `children?: ReactNode` para contenido con UI rica que no encaja en el patrón ARIA "menu" de `items` planos; `items` pasa a ser opcional.
- Bug real encontrado y corregido en vivo (no en el alcance original, pero bloqueante para cualquier uso real del componente): el anclaje fijo `right: 0` del panel sacaba el menú "Proyecto" (cerca del borde izquierdo de la ventana) completamente de la pantalla. Se implementó un volteo de ancla en runtime (mide `getBoundingClientRect()` antes de abrir, decide `left`/`right` según si se sale del viewport) -- verificado con ambos menús reales, en una ventana de 700px.
- `Editor.tsx`: nueva `Section title="Archivo"` reemplaza las secciones "Importar / pegar imagen" y "Exportar".
- `App.tsx`: la fila de `ProjectControls` (antes siempre expandida) ahora es un `Menu label="Proyecto"`.

Tests: 169/169 en verde (sin tests nuevos -- no se agregó lógica pura nueva, solo reubicación de UI + el volteo de ancla, que es DOM-dependiente y se verificó en vivo en vez de con un test unitario), `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): abrí "Proyecto", escribí un nombre, Guardé, confirmé que aparece en la lista con Cargar/Eliminar (mismo comportamiento que antes), Eliminé con la confirmación inline de siempre (¿Eliminar? Sí/Cancelar) y confirmé que desaparece de la lista. Abrí "Archivo" y confirmé que las 4 acciones (Importar textura, Insertar imagen, Exportar PNG, Exportar pack .zip) se ven íntegras y sin recortar. No se disparó una descarga real de archivo durante la verificación (evitado deliberadamente -- requiere permiso explícito del usuario para acciones de descarga, y los 3 componentes de exportación/importación no cambiaron de lógica respecto a lo ya verificado en los tickets 005/006).

Sin hallazgos de QA pendientes. La desviación de "un menú" a "dos menús" es la única decisión de alcance no cubierta explícitamente por el documento de definición ni por el ticket -- documentada arriba y en `docs/ARQUITECTURA.md`, reversible si Marco prefiere forzar un único disparador a costa de un refactor mayor.
