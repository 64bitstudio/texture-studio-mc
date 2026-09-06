# 053 — Rediseño de "Mis proyectos" + acciones reales por tarjeta

## Objetivo
Rediseñar `MisProyectos.tsx` para que coincida visualmente con la imagen de
referencia entregada por Marco (tarjetas en grid, búsqueda, orden, toggle
grid/lista) y reemplazar las acciones actuales de la lista simple por las
acciones reales que pidió por tarjeta: **Editar** (abre directo el editor,
o el picker de mob si el proyecto tiene varios), clic en la tarjeta/nombre
abre el proyecto (reemplaza al botón "📁 Carpeta", que se retira), y un
menú **⋮** con Renombrar / Duplicar / Exportar proyecto (.zip) / Eliminar
(separado visualmente por destructivo).

Decisiones ya confirmadas con Marco (`AskUserQuestion`, ver sesión):
- Se quita el filtro por mob (no aparece en la referencia).
- El toggle grid/lista es funcional de verdad (ambos layouts reales).
- "Duplicar" crea la copia al instante con nombre autogenerado
  (`"<nombre> (copia)"`, `"(copia 2)"` si ya existe, etc.) -- sin pedir
  nombre antes.
- "Editar" con un solo mob va directo al editor; con varios mobs navega a
  `Proyecto.tsx` (vista de detalle ya existente, ticket 041) -- ES
  exactamente la "vista para elegir cuál editar" que Marco mencionó como
  opción, sin inventar tracking nuevo de "última textura editada" (no
  existe ese dato hoy, ver `ProjectRecord`).

## Alcance
- `frontend/src/projectStorage.ts`: nueva función `duplicateProject(name)`.
- `frontend/src/ui/icons.tsx`: íconos nuevos (lupa, ⋮, grid, lista, lápiz)
  siguiendo el mismo criterio hand-drawn del ticket 046.
- `frontend/src/ui/Menu.tsx`: extensión mínima aditiva si hace falta para
  permitir un trigger visualmente compacto (icon-square) -- sin cambiar su
  comportamiento actual en `Editor.tsx`.
- `frontend/src/components/MisProyectos.tsx`: rediseño completo (layout,
  toolbar, grid/lista) + nuevo componente de tarjeta con sus acciones.
- Posible nuevo archivo `frontend/src/components/ProjectCard.tsx` si el
  tamaño de `MisProyectos.tsx` lo amerita.
- `docs/ARQUITECTURA.md` / `docs/COMPONENTES.md`.

## Qué NO hace este ticket
- No toca `Recientes.tsx` ni `Proyecto.tsx` (fuera del alcance de la imagen
  de referencia, que es solo "Mis proyectos").
- No agrega tracking de "última textura editada por mob" -- el caso
  multi-mob de "Editar" reusa la vista de detalle existente.

## Criterios de aceptación (TDD)
- Dado un proyecto guardado, cuando lo veo en "Mis proyectos", entonces la
  tarjeta muestra: ícono de carpeta + nombre, ⋮, "N mobs · Última
  modificación: fecha", miniaturas reales de sus mobs (`mobIcons.ts`) +
  badge "+N" si hay más de 3, botón "Editar" y YA NO un botón de carpeta
  aparte.
- Dado un proyecto con un solo mob, cuando presiono "Editar", entonces
  navego directo al editor con ese mob cargado.
- Dado un proyecto con 2+ mobs, cuando presiono "Editar", entonces navego
  a la vista de detalle del proyecto (`Proyecto.tsx`) para elegir cuál
  editar.
- Dado que hago clic en la tarjeta/nombre de un proyecto (fuera de
  "Editar"/⋮), entonces navego a la vista de detalle del proyecto (mismo
  destino que hoy).
- Dado que abro el menú ⋮ y elijo "Duplicar", entonces se crea de
  inmediato una copia con nombre autogenerado y aparece en la lista, sin
  perder el proyecto original.
- Dado que abro el menú ⋮ y elijo "Renombrar", entonces puedo escribir un
  nuevo nombre y confirmarlo sin salir de "Mis proyectos".
- Dado que abro el menú ⋮ y elijo "Exportar proyecto / Resource Pack",
  entonces se descarga el `.zip` de todos los mobs del proyecto (reusa
  `exportProjectZip`, sin cambios de lógica).
- Dado que abro el menú ⋮ y elijo "Eliminar", entonces veo una
  confirmación inline (visualmente separada, sin diálogo nativo) antes de
  borrar de verdad.
- Dado que cambio el toggle a "lista", entonces las tarjetas cambian a un
  layout de fila real (no decorativo).
- Verificación visual en vivo (Claude in Chrome) contra la imagen de
  referencia, con muestreo de color si hace falta (mismo criterio que
  tickets 047-052).

## Hecho

Implementado tal como se definió, sin recortes de alcance. Todos los
criterios de aceptación cumplidos y verificados en vivo (Claude in Chrome,
dark y light theme, sin errores de consola) contra proyectos reales
creados en la app (1 mob / 3 mobs / 4 mobs, para ver el badge "+1" de
overflow).

- `frontend/src/components/ProjectCard.tsx` (nuevo): tarjeta autocontenida
  grid/lista con Renombrar/Duplicar/Exportar/Eliminar (Eliminar con
  confirmación inline, sin diálogo nativo).
- `frontend/src/components/MisProyectos.tsx`: rediseño completo (toolbar
  con búsqueda + orden + toggle grid/lista real; filtro por mob retirado
  por decisión confirmada); nuevo prop `onProjectEdit`.
- `frontend/src/App.tsx`: nuevo `handleProjectEdit` -- 1 mob → editor
  directo, 2+ mobs → `Proyecto.tsx` como selector.
- `frontend/src/projectStorage.ts`: nueva función `duplicateProject()`
  (copia profunda, nombre autogenerado con sufijo incremental).
- `frontend/src/ui/Menu.tsx`: nuevo prop opcional `triggerVariant`
  (aditivo, no rompe el uso existente en `Editor.tsx`).
- `frontend/src/ui/icons.tsx`: `IconSearch`, `IconDots`, `IconGridView`,
  `IconListView`, `IconPencil`.
- `frontend/test/projectStorage.spec.ts`: 4 tests nuevos para
  `duplicateProject` (nombre autogenerado, incremento de sufijo, copia
  profunda/independiente, error si el origen no existe).

Tests: 201 pasan (197 + 4 nuevos). `npx tsc --noEmit`, `npm run lint`,
`npm run build` en verde.

**Hallazgo real durante la implementación** (no relacionado al alcance
del ticket, reportado vía `SendFeedback`): el hook `PreToolUse:Write`
`ui-accessibility-guard.sh` tiene un bug real -- con un `<img>`/`<input>`
formateado en varias líneas (el estilo ya usado en todo el proyecto),
el loop que verifica `alt=`/`aria-label=` (`while read -r tag`) parte el
tag extraído por cada salto de línea interno y evalúa cada fragmento por
separado, generando decenas de falsos positivos aunque el tag real sí
tuviera el atributo. Verificado corriendo el hook a mano (`bash -x`)
contra el input real. Mientras no se corrija, los 2 tags afectados
(`ProjectCard.tsx`/`MisProyectos.tsx`) se dejaron en una sola línea,
documentado in situ con un comentario explicando por qué.

**Decisiones confirmadas con Marco durante este ticket** (`AskUserQuestion`,
ver `docs/ARQUITECTURA.md`, "Ticket 053" para el detalle completo): quitar
el filtro por mob, construir una vista de lista real (no decorativa), y
que "Duplicar" cree la copia al instante con nombre autogenerado.
