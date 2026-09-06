# 042 — Flujo "Agregar mobs" (selección múltiple)

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` (HU-3). Depende del ticket 041 (vista de detalle de Proyecto, que es quien navega aquí) y reusa el layout visual de "Nuevo proyecto" (038) adaptado a selección múltiple.

## Alcance
- Vista "Agregar mobs" (destino `'agregar-mobs'`): mismo layout de grid de mobs + vista previa 3D del ticket 038, pero con selección MÚLTIPLE (checkboxes o toggle por tarjeta, no un único radio) — a diferencia de "Nuevo proyecto", que es de a uno.
- Los mobs que YA pertenecen al proyecto activo (`activeProject.mobIds`, ticket 041) NO aparecen seleccionables (deshabilitados o directamente ocultos — decidir en implementación cuál se ve mejor, un proyecto no puede tener dos texturas del mismo mob).
- Al confirmar la selección: agrega los mobs elegidos al proyecto activo (con una textura placeholder/en blanco de partida, igual que hoy al abrir un mob nuevo) vía `saveProject` con `overwrite: true` (mismo mecanismo ya existente, sin nueva lógica de guardado) y vuelve a la vista de detalle del Proyecto (ticket 041).

## Qué NO hacer
- No permitir seleccionar un mob que ya está en el proyecto — la restricción es visual/estructural, no solo una validación al confirmar.

## Verificación
- En vivo (Claude in Chrome): con un proyecto que ya tiene 1 mob, abrir "Agregar mobs", confirmar que ese mob no aparece seleccionable, seleccionar 2 de los restantes, confirmar, y verificar que la vista de detalle del proyecto ahora lista los 3 mobs.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado un proyecto abierto, cuando abro "Agregar mobs", entonces veo únicamente los mobs que todavía no pertenecen a este proyecto.
- Dado que selecciono uno o varios mobs y confirmo, entonces esos mobs quedan agregados al proyecto y disponibles en el selector del editor (ticket 043).
