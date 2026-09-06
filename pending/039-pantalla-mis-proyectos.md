# 039 — Pantalla "Mis proyectos"

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` (HU-5, alcance — "Mis proyectos" es "Guardados" reubicado). Depende del ticket 037 (shell de navegación).

## Alcance
- Vista "Mis proyectos" (destino `'mis-proyectos'`): la misma lista con búsqueda por nombre + filtro por mob + orden que YA EXISTE en `HomeScreen.tsx`/`projectFilter.ts` (tickets 027/028) — se reubica como su propio destino de navegación, SIN cambios de lógica (reusa `filterAndSortProjects`/`collectMobIdsInProjects` tal cual).
- Al elegir un proyecto de la lista: navega a la vista de detalle del Proyecto (`'proyecto'`, ticket 041) — a diferencia de hoy, que iba directo al editor del primer mob del proyecto.

## Qué NO hacer
- No reimplementar la lógica de búsqueda/filtro/orden — es un traslado de UI, la lógica pura (`projectFilter.ts`) no cambia.
- No mezclar esta pantalla con "Recientes" (ticket 040) — son destinos separados, aunque lean la misma fuente de datos.

## Verificación
- En vivo (Claude in Chrome): confirmar que buscar/filtrar/ordenar se comporta exactamente igual que la sección "Guardados" que reemplaza (mismos casos ya verificados en el ticket 028); confirmar que elegir un proyecto navega a su vista de detalle, no directo al editor.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que estoy en "Mis proyectos", cuando busco por nombre/filtro por mob/cambio el orden, entonces se comporta igual que la lista "Guardados" ya existente.
- Dado que elijo un proyecto de la lista, entonces navego a su vista de detalle (no directo al editor de un mob).
