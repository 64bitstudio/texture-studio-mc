# 043 — Selector de mob del editor restringido al proyecto activo

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` (HU-2, "Diseño técnico" — editor restringido al proyecto activo). Depende de 041 (`activeProject`) y 042 (destino del control "+ Agregar mob").

## Alcance
- `MobSelector.tsx` dentro del editor deja de mostrar el catálogo completo de 4 mobs — filtra contra `activeProject.mobIds` (estado de `App.tsx`, ticket 041), mostrando solo los mobs que ya pertenecen al proyecto abierto.
- Gana un control adicional "+ Agregar mob" al final de la lista, que navega a `'agregar-mobs'` (ticket 042) sin perder el trabajo en curso del mob que se estaba editando (mismo mecanismo de `bufferCache` ya existente, ticket 018 — no requiere nueva lógica de guardado).

## Qué NO hacer
- No permitir cambiar a un mob que no pertenece al proyecto activo desde este selector — esa es exactamente la restricción que confirmó Marco en la fase de definición.

## Verificación
- En vivo (Claude in Chrome): con un proyecto de 2 mobs, confirmar que el selector del editor muestra SOLO esos 2 (no los otros 2 del catálogo completo); hacer click en "+ Agregar mob" y confirmar que navega al flujo del ticket 042.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado un proyecto con 2 mobs, cuando estoy en el editor, entonces el selector de mob muestra únicamente esos 2 (más el control "+ Agregar mob").
- Dado que hago click en "+ Agregar mob", entonces navego al flujo de selección múltiple (ticket 042) sin perder lo que tenía pintado en el mob activo.
