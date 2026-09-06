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

## Hecho

Implementado tal como estaba alcanzado, con una limpieza real adicional documentada:

- `MisProyectos.tsx` (nuevo): extraído de la sección "Guardados" de `HomeScreen.tsx`, SIN cambios de lógica de búsqueda/filtro/orden (`filterAndSortProjects`/`collectMobIdsInProjects` reusadas tal cual). Único cambio real: `handleOpenProject` sigue restaurando buffers igual que antes, pero llama a `onProjectSelected` (navega a `'proyecto'`) en vez de `onProjectOpened` (navegaba a `'editor'`).
- `App.tsx`: `handleProjectActivated` unifica el "proyecto activo, navegar a su detalle" compartido entre `NuevoProyecto.tsx` (ticket 038) y `MisProyectos.tsx` (este ticket), reemplazando dos handlers casi idénticos.
- `HomeScreen.tsx` **eliminado por completo** (`git rm`, no solo se deja de usar) -- con ambos destinos (038/039) mostrando su contenido real, quedó sin ningún consumidor (confirmado con `grep` antes de borrarlo). Mismo criterio ya aplicado en el ticket 029 (`PanelResizeHandle.tsx`) -- decisión real, adelantada respecto al ticket 045 (que originalmente iba a hacer esta limpieza), documentada explícitamente en `docs/ARQUITECTURA.md`.
- Comentarios en `index.css`/`projectStorage.ts` que referenciaban `HomeScreen.tsx` actualizados para apuntar a `MisProyectos.tsx`.

Tests: 184/184 en verde (sin tests nuevos -- mismo criterio que `NuevoProyecto.tsx`, verificado en vivo), `npm run lint` y `npm run build` en verde (`build` también confirmó que ningún import roto quedó apuntando al archivo eliminado).

Verificación en vivo (Claude in Chrome, local): "Mis proyectos" lista el proyecto guardado en el ticket 038 con los mismos controles de búsqueda/orden; buscar un texto sin coincidencias muestra el mensaje ya existente; elegir el proyecto navega a "Proyecto: Set Nether" (vista de detalle, NO el editor).

Sin hallazgos de QA pendientes.
