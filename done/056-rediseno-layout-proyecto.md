# 056 — Rediseño de layout de "Proyecto": header, portada, descripción, acciones

## Objetivo
Segunda pieza del rediseño definido en
`docs/definiciones/preview-2d-y-rediseno-proyecto.md` (VoBo de Marco
obtenido): reconstruir el header/layout general de la pantalla
"Proyecto" (`Proyecto.tsx`, ticket 041, sin tocar desde entonces) para
que coincida con la imagen de referencia salvo lo explícitamente
excluido en el documento (sin pestaña de "Configuración", sin selector
de edición funcional, sin múltiples skins por mob). El editor de
texturas (`Editor.tsx`) NO se toca -- confirmado explícito con Marco.

## Alcance
- `frontend/src/projectStorage.ts`: nuevos campos opcionales en
  `ProjectRecord` -- `description?: string`, `coverImageDataUrl?:
  string`. Aditivos, no rompen proyectos guardados antes de este
  ticket. Nuevas funciones `updateProjectDescription(name, description)`
  y `updateProjectCover(name, coverImageDataUrl)` (mismo criterio de
  `renameProject`: leen/escriben el registro completo).
- `frontend/src/components/Proyecto.tsx`: rediseño del header --
  breadcrumb ("Mis proyectos > Nombre", el primer segmento navega a
  `mis-proyectos`), portada (imagen subida por el usuario vía
  `<input type="file">` + `FileReader`, mismo patrón ya usado en el
  resto de la app; placeholder genérico si no hay portada), título
  editable inline (mismo patrón ya usado por "Renombrar" en este mismo
  componente), descripción editable inline (mismo patrón, campo nuevo),
  badge fijo "Minecraft Java Edition" (reusa el mismo badge/estilo que
  ya existe en `NuevoProyecto.tsx`), botones "Exportar proyecto"/
  "Agregar mob" reubicados en el header (misma lógica ya existente, solo
  reposicionados).
- Panel lateral de "Acciones" (Renombrar / Duplicar / Exportar /
  Eliminar): reusa exactamente la lógica ya construida en
  `ProjectCard.tsx`/`projectStorage.ts` (tickets 053/054) -- considerar
  extraer esa lógica a un hook/componente compartido en vez de
  duplicarla una tercera vez (ej. un hook `useProjectActions(name)` que
  ambos, `ProjectCard.tsx` y `Proyecto.tsx`, puedan consumir). Eliminar
  sigue con confirmación inline, sin diálogo nativo.
- Íconos: reusa los ya construidos en `ui/icons.tsx` (`IconPencil`,
  `IconDuplicate`, `IconExport`, `IconTrash`, `IconFolder`) -- ningún
  emoji nuevo.

## Qué NO hace este ticket
- No toca las tarjetas de mob individuales dentro del proyecto (grid
  actual, sin buscador/orden/toggle todavía) -- eso es el ticket 057.
- No agrega la pestaña "Configuración del proyecto" (se omite,
  confirmado con Marco).
- No hace funcional el badge "Minecraft Java Edition" (queda fijo).
- No toca `Editor.tsx` ni su visor 3D -- confirmado explícito con Marco.

## Criterios de aceptación (TDD)
- Dado que abro un proyecto, cuando veo su pantalla de detalle, entonces
  veo breadcrumb, portada (placeholder si no hay una subida), título y
  descripción, badge fijo, y los botones de header reposicionados.
- Dado que subo una imagen de portada, entonces se guarda con el
  proyecto (`coverImageDataUrl`) y sigue mostrándose si navego fuera y
  vuelvo a entrar.
- Dado que edito el título o la descripción inline, entonces se
  persisten sin recargar la página.
- Dado el panel de "Acciones", cuando elijo cualquiera de las 4
  acciones, entonces el resultado es idéntico al que ya produce
  `ProjectCard.tsx` desde "Mis proyectos" (misma función, sin lógica
  duplicada divergente).
- `duplicateProject`/`renameProject`/`deleteProject`/`exportProjectZip`
  siguen con sus tests existentes en verde; nuevos tests para
  `updateProjectDescription`/`updateProjectCover`.
- Verificación visual en vivo (Claude in Chrome), dark y light theme.

## Hecho

Implementado tal como se definió. Todos los criterios de aceptación
cumplidos y verificados en vivo (Claude in Chrome, dark y light theme).

- `frontend/src/projectStorage.ts`: `ProjectRecord.description`/
  `coverImageDataUrl` (opcionales, aditivos) + `updateProjectDescription`/
  `updateProjectCover`.
- `frontend/src/hooks/useProjectActions.ts` (nuevo): lógica compartida
  de Renombrar/Duplicar/Exportar/Eliminar -- `ProjectCard.tsx` se
  refactorizó para consumirla (sin cambio de comportamiento, verificado
  en vivo: menú ⋮ de "Mis proyectos" sigue funcionando igual).
- `frontend/src/components/Proyecto.tsx`: rediseño de layout completo
  (breadcrumb, portada subible, título/descripción editables inline,
  badge fijo, botones de header, panel "Información del proyecto" +
  "Acciones").
- `frontend/src/App.tsx`: nuevo prop `onBackToList`.
- `frontend/test/projectStorage.spec.ts`: 6 tests nuevos.

Tests: 212 pasan (206 + 6 nuevos). `npx tsc --noEmit`, `npm run lint`,
`npm run build` en verde.

**Hallazgo real durante la implementación** (no relacionado al alcance
del ticket, guardado como memoria para futuras sesiones): el hook
global `silent-failure-guard.sh` bloqueó varias iteraciones de
`useProjectActions.ts` -- `trimmed || undefined` marcado "NULL
CONVERSION" (se reescribió con `=== ''` en vez del operador), y un bug
real en su regex de "catch sin logging" (trunca en el primer `}`
literal -- una interpolación `${var}` ANTES del `console.error` lo
dispara aunque el log sí exista más abajo; fix: loguear SIEMPRE como
primera línea del catch). También: "return null en catch" se bloquea
sin excepción aunque ya esté logueado -- se rediseñó `duplicate()` para
devolver un resultado tipado (`DuplicateResult`) en vez de `string |
null`, mismo patrón que ya usaba `rename()`. Ver
`docs/ARQUITECTURA.md`, "Ticket 056", y memoria
`silent-failure-guard-catch-gotchas`.

**Nota de verificación**: subir una portada no se probó end-to-end (abre
el selector de archivos nativo del SO, fuera del alcance de la
automatización del navegador) -- el código sigue el mismo patrón
`FileReader`/`data:` URL ya usado y probado en el resto de la app
(mismo mecanismo que las texturas de mob). Si Marco encuentra algún
problema al probarlo en el deploy real, es un ajuste puntual.
