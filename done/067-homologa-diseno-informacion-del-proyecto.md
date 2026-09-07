# 067 — Homologa el diseño de "Información del proyecto" con la referencia

## Objetivo
Marco mandó 2 imágenes (lo que tenemos vs. lo esperado) del panel
"Información del proyecto"/"Acciones": "la imagen 30 es lo que tenemos
y la 31 es lo que espero, homologa el diseño".

## Alcance
- `components/Proyecto.tsx`:
  - Encabezados "Información del proyecto"/"Acciones": de mayúsculas
    con tracking (`.ui-section__title`, compartido con el resto de la
    app) a texto normal en negrita, más grande -- override local (sin
    tocar la clase compartida, que sigue usándose igual en "Mobs de
    este proyecto (N)").
  - Cada fila (Nombre/Mobs/Última modificación) cambia de "ícono
    inline junto a la etiqueta chica" a un ícono más grande (13px ->
    20px) al lado de un bloque de 2 líneas (etiqueta arriba, valor
    abajo).
  - Nueva fila "Descripción" (con `IconDocument`) -- el dato ya existía
    (`record.description`, ticket 056), solo faltaba mostrarlo también
    aquí (antes solo se veía/editaba en el header). Mismo fallback
    ("Sin descripción todavía.") que ya usa el header.
  - Reasignación de íconos para que calcen mejor semánticamente con el
    nuevo layout: Nombre -> `IconFolder` (ya usado en la app para
    "proyecto"), Mobs -> `IconModel` (ya usado como "modelo" en las
    tarjetas de mob), Última modificación -> `IconClock`, Descripción
    -> `IconDocument`.

## Criterios de aceptación (TDD)
- Dado el panel "Información del proyecto", cuando lo veo, entonces los
  encabezados están en texto normal negrita (no mayúsculas), cada fila
  tiene un ícono grande al lado de etiqueta+valor, y hay una fila
  "Descripción" con el texto real del proyecto.
- Verificación visual en vivo (Claude in Chrome) contra las 2 imágenes
  de referencia de Marco, dark y light theme.

## Hecho

- `Proyecto.tsx`: encabezados "Información del proyecto"/"Acciones"
  con override local (`fontSize: var(--font-md)`, `fontWeight: 700`,
  `color: var(--text)`, sin `text-transform`) en vez de
  `.ui-section__title` (esa clase sigue igual para el resto de la
  app); cada fila del `dl` reestructurada con el ícono (20px) como
  hermano de un bloque `<dt>`/`<dd>` de 2 líneas; nueva fila
  "Descripción"; íconos reasignados (Nombre/Mobs/Última modificación/
  Descripción -> Folder/Model/Clock/Document).
- Verificación: `npx tsc --noEmit`, `npx oxlint`, `npm run build`
  limpios; `npx vitest run` -- 215/215 tests en verde (ticket 100%
  visual, sin lógica nueva). Verificación visual en vivo (Claude in
  Chrome) contra el proyecto real "Set Nether", comparado directamente
  contra las 2 imágenes de referencia de Marco -- coincide en
  estructura y estilo, dark y light theme, sin errores de consola.
