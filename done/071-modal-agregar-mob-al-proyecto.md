# 071 — Modal "Agregar mob" al proyecto

## Objetivo
Reemplazar la pantalla completa "Agregar mobs" (`AgregarMobs.tsx`, ticket 042) por un modal (pedido de Marco, con imagen de referencia) que se abre sobre "Proyecto" para agregar un mob del catálogo actual (Esqueleto/Zombie/Araña/Creeper) sin navegar a una pantalla aparte.

## Criterios de aceptación (TDD)
- Dado que el proyecto no tiene todos los mobs del catálogo, cuando se hace click en "Agregar mob" (desde "Proyecto" o desde el sidebar del Editor), entonces se abre un modal con buscador + grid de mobs disponibles (excluye los que el proyecto ya tiene).
- Dado que se selecciona un mob del grid, cuando se confirma con "Agregar mob", entonces el mob se agrega al proyecto con su textura base (vanilla/placeholder) y el modal se cierra sin navegar de pantalla.
- Dado que el proyecto ya tiene TODOS los mobs del catálogo, cuando se abre el modal, entonces se muestra un estado vacío explicativo en vez de un grid vacío.
- Dado que se cancela (botón "Cancelar", tecla Escape, o click fuera del panel), cuando el modal se cierra, entonces no se agrega ningún mob.

## Hecho
Implementado `AgregarMobModal.tsx` (nuevo) reemplazando `AgregarMobs.tsx` (eliminado). Alcance confirmado con Marco vía `AskUserQuestion` antes de implementar: selección de un mob a la vez (no múltiple), sin barra de categorías (catálogo actual de 4 mobs, todos "Hostiles" en la clasificación vanilla), sin visor 3D en vivo (ícono oficial + descripción + resolución/modelo derivados en su lugar). Reusa `buildProjectSnapshot`+`saveProject` para confirmar el agregado.

Bug real encontrado y corregido en el camino: `saveProject` (`projectStorage.ts`) perdía silenciosamente `description`/`coverImageDataUrl` al sobrescribir un proyecto existente -- bug desde el ticket 042, nunca antes ejercitado en pruebas porque ningún proyecto probado en vivo tenía ambas cosas (descripción/portada Y un mob agregado en la misma sesión).

Verificado en vivo (Claude in Chrome): abrir el modal desde "Proyecto" y desde el sidebar del Editor (ticket 072), agregar un mob real y confirmar que persiste, catálogo ya completo (estado vacío), cancelar por los 3 caminos (botón/Escape/click afuera). `tsc`/`oxlint`/`vitest` (215)/`build` en verde.

Nota: este ticket y el 072/073 se implementaron en la misma sesión de iteración en vivo con Marco, con cambios entrelazados en algunos archivos compartidos (`App.tsx`) -- van en un único PR (decisión explícita de Marco al dar el VoBo final, ver 073).
