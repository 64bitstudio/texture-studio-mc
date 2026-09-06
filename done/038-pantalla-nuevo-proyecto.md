# 038 — Pantalla "Nuevo proyecto"

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` (HU-1, "Diseño técnico" — el proyecto pasa a ser una entidad explícita desde su creación). Depende del ticket 037 (shell de navegación) para tener dónde vivir.

## Alcance
- Vista "Nuevo proyecto" (destino `'nuevo-proyecto'` del ticket 037): campo "Nombre del proyecto", grid de selección de UN mob (Esqueleto/Zombie/Araña/Creeper, selección única con indicador visual, igual que el mockup de referencia), panel de "Vista previa" con el render 3D en vivo del mob elegido (reusa `Viewer3D` ya existente) + nota de que es solo vista previa aproximada.
- Botón "Crear proyecto": valida nombre no vacío + mob elegido; si el nombre ya existe, reusa el mismo aviso de "ya existe / sobrescribir" que ya tiene `ProjectControls.tsx` (ticket 019) — no duplicar esa lógica de confirmación.
- Al crear con éxito: llama a `saveProject` (ticket 019, sin cambio de forma) con el proyecto recién nacido (nombre + el mob elegido con una textura en blanco/placeholder de partida) y navega a la vista de detalle del Proyecto (`'proyecto'`, ticket 041).

## Qué NO hacer
- No permitir seleccionar más de un mob en esta pantalla — la selección múltiple es exclusiva del flujo "Agregar mobs" (ticket 042), que se usa DESPUÉS de creado el proyecto.

## Verificación
- En vivo (Claude in Chrome): crear un proyecto con nombre + un mob, confirmar la vista previa 3D en vivo al cambiar de mob elegido, confirmar que sin nombre o sin mob el botón no crea nada (error inline), confirmar que un nombre repetido dispara el aviso de sobrescritura ya existente.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que estoy en "Nuevo proyecto", cuando escribo un nombre y elijo un mob, entonces veo una vista previa 3D en vivo de ese mob.
- Dado que hago click en "Crear proyecto" sin nombre o sin mob elegido, entonces veo un error inline y el proyecto no se crea.
- Dado que creo el proyecto con éxito, entonces navego a la vista de detalle de ese proyecto, que ya muestra el mob elegido.
- Dado que el nombre ya existe entre mis proyectos guardados, cuando intento crear uno con el mismo nombre, entonces veo el aviso de sobrescritura ya existente (ticket 019).

## Hecho

Implementado tal como estaba alcanzado:

- `NuevoProyecto.tsx` (nuevo): nombre + selección de UN mob + vista previa 3D en vivo (`Viewer3D`/`useCanvasTexture`, mismo pipeline que `Editor.tsx` usa para su buffer inicial). `assetCache` local evita re-pedir el asset de un mob ya visitado en esta misma pantalla.
- `saveProject` se llama con `Map` LOCALES de un solo mob -- deliberadamente NO el `bufferCache`/`geometryCache` compartido de `App.tsx` (que acumula cualquier mob visitado en la sesión) para que el proyecto nuevo arranque únicamente con el mob elegido.
- `App.tsx`: nuevo estado `activeProject` (adelanto mínimo del ticket 041) + `handleProjectCreated`, que navega a `'proyecto'` mostrando el nombre real del proyecto recién creado en el `PlaceholderScreen` (la vista de detalle completa es el ticket 041).

Tests: 184/184 en verde (sin tests nuevos -- este componente depende de canvas/DOM/fetch de punta a punta, verificado en vivo en vez de con mocks, mismo criterio ya aplicado a `projectSnapshot.ts`), `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): vista previa 3D actualiza en vivo al cambiar de mob (los 4); crear sin nombre muestra el error inline y no crea nada; crear con éxito navega a "Proyecto: Set Nether" con `activeProject` poblado; confirmado con `localStorage` real que el proyecto quedó con exactamente 1 mob y un PNG válido; repetir el nombre dispara el aviso de sobrescritura ya existente del ticket 019.

Sin hallazgos de QA pendientes.
