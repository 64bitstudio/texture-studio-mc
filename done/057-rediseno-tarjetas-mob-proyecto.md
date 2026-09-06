# 057 — Rediseño de tarjetas de mob dentro de "Proyecto"

## Objetivo
Tercera y última pieza del rediseño definido en
`docs/definiciones/preview-2d-y-rediseno-proyecto.md` (VoBo de Marco
obtenido): reemplazar el grid simple de tarjetas de mob de
`Proyecto.tsx` (hoy: imagen `pngDataUrl` cruda + nombre, click abre el
editor) por tarjetas con buscador/orden/toggle grid-lista, la miniatura
2D del motor del ticket 055, info derivada, botón "Editar textura" y un
ícono de ojo con preview ampliado. El botón "Editar textura" sigue
llevando al editor actual (`Editor.tsx`) SIN NINGÚN CAMBIO -- confirmado
explícito con Marco, no es negociable en este ticket.

## Alcance
- Buscador + orden (por nombre de mob) + toggle grid/lista sobre los
  mobs del proyecto activo -- mismo patrón/componentes ya construidos en
  `MisProyectos.tsx` (ticket 053), reusados (extraer a un componente
  compartido si el reuso directo no es limpio, ej. un
  `SearchSortToggleBar` genérico).
- Tarjeta de mob (nueva, ej. `MobEntryCard.tsx`) con:
  - Miniatura 2D via el motor del ticket 055 (memoizada por
    `pngDataUrl`).
  - Nombre del mob (label del catálogo, ej. "Creeper") -- SIN nombre
    custom por skin (confirmado: no hay múltiples skins por mob).
  - Info derivada, sin storage nuevo: nombre de archivo vanilla (ej.
    "creeper.png", derivable del mobId), dimensiones en px
    (`resolution × geometry.textureWidth/Height`), escala de trabajo
    (`resolution` tal cual, ej. "x1", "x4"). El campo "Modelo: X" de la
    imagen de referencia se omite (documento de definición, redundante
    sin multi-skin).
  - Botón "Editar textura" -- mismo `onSelectMob`/navegación al editor
    que ya usa `Proyecto.tsx` hoy, sin cambios de comportamiento.
  - Ícono de "ojo" -- abre un modal con la miniatura 2D ampliada (mismo
    render, más grande), sin navegar al editor. Sin diálogo nativo
    (mismo criterio del resto de la app) -- un overlay propio en el DOM.
- `Proyecto.tsx` pasa a montar estas tarjetas nuevas en vez del grid
  simple actual (que ya fue reemplazado en su header por el ticket 056).

## Qué NO hace este ticket
- No modifica `Editor.tsx` de ninguna forma -- el botón "Editar textura"
  navega exactamente igual que hoy.
- No agrega la rotación 2D de partes con pivote (arañas) al motor del
  ticket 055 -- limitación conocida y aceptada.
- No agrega soporte de múltiples skins por mob -- confirmado que no se
  quiere.

## Criterios de aceptación (TDD)
- Dado un proyecto con varios mobs, cuando escribo en el buscador,
  entonces la lista se filtra por nombre del mob.
- Dado que cambio el toggle a "lista", entonces las tarjetas cambian de
  layout de verdad (no decorativo).
- Dado una tarjeta de mob, cuando la veo, entonces muestra la miniatura
  2D (no la textura plana, no un ícono genérico), archivo/dimensiones/
  escala derivados correctamente, y el botón "Editar textura".
- Dado que presiono "Editar textura", entonces navego al editor actual
  con ese mob cargado -- mismo comportamiento exacto que antes de este
  ticket.
- Dado que presiono el ícono de ojo, entonces veo la miniatura 2D
  ampliada en un modal, sin navegar al editor; puedo cerrarlo sin perder
  el estado de la pantalla.
- Verificación visual en vivo (Claude in Chrome), dark y light theme,
  con al menos un proyecto de varios mobs.

## Hecho

Implementado tal como se definió. Todos los criterios de aceptación
cumplidos y verificados en vivo (Claude in Chrome, dark y light theme,
proyecto real de 4 mobs).

- `frontend/src/ui/SearchSortToggleBar.tsx` (nuevo): extraído de
  `MisProyectos.tsx` -- orden opcional (`sortOptions`), omitido en
  `Proyecto.tsx` porque el único orden real de mobs es alfabético
  siempre (sin `updatedAt` por mob).
- `frontend/src/projectMobFilter.ts` (nuevo, puro):
  `filterAndSortProjectMobs`.
- `frontend/src/components/MobEntryCard.tsx` (nuevo): tarjeta grid/lista
  con miniatura 2D, info derivada (archivo/dimensiones/escala, sin
  storage nuevo), "Editar textura", modal de vista previa (ícono de
  ojo, overlay propio sin diálogo nativo).
- `frontend/src/components/Proyecto.tsx`: usa `SearchSortToggleBar` +
  `MobEntryCard`; se retira `MobThumbnail2D` (ticket 055, superado).
- `frontend/src/components/MisProyectos.tsx`: refactorizado para
  consumir `SearchSortToggleBar` (sin cambio de comportamiento,
  verificado en vivo).
- `frontend/test/projectMobFilter.spec.ts`: 4 tests nuevos.

Tests: 216 pasan (212 + 4 nuevos). `npx tsc --noEmit`, `npm run lint`,
`npm run build` en verde.

**Confirmado explícito**: "Editar textura" navega al editor actual
(`Editor.tsx`) exactamente igual que antes de este ticket -- verificado
en vivo, layout del editor sin ningún cambio.

**Nota**: la Araña sigue mostrando la limitación conocida del ticket
055 (patas sin rotar, ver ese ticket) tanto en la miniatura de la
tarjeta como en el modal de vista previa ampliada -- comportamiento
esperado, no un hallazgo nuevo de este ticket.

Con este ticket se completa el rediseño de "Proyecto" de 3 partes
(055/056/057) definido en
`docs/definiciones/preview-2d-y-rediseno-proyecto.md`.
