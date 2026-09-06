# 040 — Pantalla "Recientes"

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` (HU-5, alcance — "Recientes" deriva de la fecha de guardado ya existente). Depende del ticket 037 (shell de navegación).

## Alcance
- Vista "Recientes" (destino `'recientes'`): los N proyectos guardados más recientemente (por `updatedAt`, ya existente en `ProjectSummary` — sin trackear una fecha nueva de "última apertura"), N=5 de partida (ajustable sin impacto arquitectónico).
- A diferencia de "Mis proyectos" (ticket 039), esta vista NO tiene controles de búsqueda/filtro/orden — es una lista compacta de solo lectura + acción de abrir.
- Al elegir un proyecto: navega a su vista de detalle (`'proyecto'`, ticket 041), igual que "Mis proyectos".

## Qué NO hacer
- No agregar búsqueda/filtro a esta vista — para eso está "Mis proyectos". Si el usuario necesita buscar, esta pantalla no es el lugar.
- No trackear una fecha nueva de "última apertura" — usa `updatedAt` (fecha de último guardado) tal cual, ya disponible sin cambios de datos.

## Verificación
- En vivo (Claude in Chrome): con varios proyectos guardados en distintos momentos, confirmar que "Recientes" muestra los más recientes primero, máximo 5, sin controles de búsqueda visibles.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que tengo más de 5 proyectos guardados, cuando abro "Recientes", entonces veo únicamente los 5 más recientes por fecha de guardado, sin controles de búsqueda/filtro.
- Dado que elijo uno de la lista, entonces navego a su vista de detalle.

## Hecho

Implementado tal como estaba alcanzado:

- `Recientes.tsx` (nuevo): `filterAndSortProjects` (ticket 028, sin cambios) con `searchText`/`mobId` vacíos + `.slice(0, 5)` -- sin duplicar lógica de orden. Sin controles de búsqueda/filtro/orden propios (de solo lectura). Abrir un proyecto reusa la misma lógica de restaurar buffers de `MisProyectos.tsx` y navega a `'proyecto'` vía `onProjectSelected`/`handleProjectActivated` (compartido con los tickets 038/039).
- `App.tsx`: "Recientes" reemplaza el `PlaceholderScreen` del ticket 037 por el componente real.

Tests: 184/184 en verde (sin tests nuevos -- mismo criterio que `MisProyectos.tsx`/`NuevoProyecto.tsx`, componente dependiente de DOM/localStorage verificado en vivo), `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): sembrados 7 proyectos de prueba con fechas crecientes -- confirmado que "Recientes" muestra EXACTAMENTE los 5 más recientes, sin controles de búsqueda visibles, y que los más antiguos no aparecen; abrir uno con datos inválidos (deliberado) mostró el error inline sin romper la pantalla; abrir uno con datos válidos navegó correctamente a la vista de detalle. Datos de prueba limpiados de `localStorage` antes de cerrar.

Sin hallazgos de QA pendientes.
