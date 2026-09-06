# 028 — Pantalla de "Guardados" con búsqueda/filtro/orden (HU-2)

## Objetivo
Sale de `docs/definiciones/rediseno-ux-ui-y-navegacion.md` (HU-2, Diseño técnico "Pantalla de Guardados: filtro/orden 100% client-side"). Depende del ticket 027 (punto de entrada ya existente).

## Alcance
- Vista de "Guardados" completa: lista de proyectos (nombre, fecha, mobs que contiene — ya expuesto por `projectStorage.listProjects()`, ticket 019, sin cambios de esquema).
- Campo de búsqueda por nombre (filtro en tiempo real, client-side).
- Filtro por mob contenido (ej. chip/select "Araña" → solo proyectos que incluyen Araña).
- Control de orden (fecha más reciente primero -- ya es el default actual: o por nombre).
- Seleccionar un proyecto de la lista abre el editor con ese proyecto cargado (mismo mecanismo ya verificado en el ticket 019).

## Qué NO hacer
- No tocar `projectStorage.ts`/`projectSnapshot.ts` ni el formato de `localStorage` -- todo el filtro/orden es cómputo en memoria sobre el array que ya devuelve `listProjects()`.

## Verificación
- En vivo (Claude in Chrome): crear/usar varios proyectos guardados de prueba con distintos mobs, confirmar que buscar por nombre, filtrar por mob y cambiar el orden funcionan correctamente y en combinación.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado varios proyectos guardados, cuando busco por nombre, entonces la lista se filtra a los que coinciden.
- Dado un filtro por mob, cuando se aplica, entonces solo veo proyectos que incluyen ese mob.
- Dado que elijo un proyecto de la lista filtrada, cuando se abre, entonces el editor carga exactamente ese proyecto.
