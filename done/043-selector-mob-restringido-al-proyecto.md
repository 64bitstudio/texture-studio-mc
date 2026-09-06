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

## Hecho

Implementado tal como estaba alcanzado:

- `MobSelector.tsx`: sigue sin saber nada de "proyecto" (genérico, mismo criterio del ticket 018) -- gana un prop opcional `onAddMob` que renderiza "+ Agregar mob" al final de la lista solo si se pasa.
- `App.tsx`: nuevo `editorMobs` filtra `mobsState.mobs` contra `activeProject.mobIds` ANTES de pasarlo a `MobSelector` (el filtro vive en el llamador, no en el componente). Fallback al catálogo completo si `activeProject` es `null` es puramente defensivo -- documentado que no debería ser alcanzable desde ninguna UI real en este punto del epic (038-042 ya funnelan toda navegación al editor a través de un proyecto activo).
- "+ Agregar mob" reusa `handleAddMobs` sin cambios (mismo handler que el botón de `Proyecto.tsx`, ticket 041) -- sin duplicar lógica de navegación.

Tests: 188/188 en verde (sin tests nuevos -- cambio de UI/routing, verificado en vivo), `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): con el proyecto "Set Nether" (Esqueleto/Zombie/Creeper), el selector del editor mostró EXACTAMENTE esos 3 mobs (Araña, el cuarto del catálogo, no apareció) más "+ Agregar mob"; hacer click navegó al flujo de selección múltiple mostrando solo Araña disponible. Prueba de preservación de trabajo (más allá de lo pedido explícitamente, para verificar el mecanismo real): se pintó un píxel rojo distintivo en Esqueleto (confirmado con `getImageData`), se navegó a "Agregar mob", se canceló, y al volver a Esqueleto el mismo píxel rojo seguía presente -- confirma que `bufferCache` preserva el trabajo en curso a través de la navegación.

Sin hallazgos de QA pendientes.
