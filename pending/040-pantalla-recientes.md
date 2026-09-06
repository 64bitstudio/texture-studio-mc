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
