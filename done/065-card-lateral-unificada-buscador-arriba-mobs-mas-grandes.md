# 065 — Card lateral unificada con fondo real, buscador a todo lo ancho, mobs más grandes en el snapshot 3D

## Objetivo
Ronda de ajustes de Marco (imagen de referencia de su proyecto real
"Galgoth_v1"): "la card de informacion del proyecto y acciones es una
misma card pero con division y le falta background (es el mismo color
que el de la card de los mobs), ademas los mobs deben verse mas
grande, el contenedor esta bien de tamano, pero acerca mas los mobs
cuando tomes la captura para que se vean mas grandes, por ultimo la
card de informacion del proyecto debe estar a la altura de las cards
de los mobs para que el formulario y los botones de grid lista esten
hasta la derecha".

## Alcance
- `components/Proyecto.tsx`:
  - "Información del proyecto" y "Acciones" pasan de ser 2 cards
    separadas a UNA sola card (`<Section>`) con ambos sub-encabezados y
    un separador de 1px entre ambas secciones.
  - Esa card gana fondo real (`background: var(--surface-raised)`,
    igual que las tarjetas de mob) -- hallazgo real de Marco: el fondo
    por defecto de `<Section>` (`--panel-bg`) es IGUAL a `--bg` (fondo
    de toda la pantalla) en ambos temas, así que la card se veía "sin
    fondo".
  - El buscador + el toggle grid/lista pasan a compartir fila con el
    encabezado "Mobs de este proyecto (N)" EN TODO EL ANCHO del
    contenido (antes solo sobre la columna izquierda) -- así quedan
    "hasta la derecha" de verdad, alineados con el borde derecho de la
    card lateral. La grid de 2 columnas (mobs | card lateral) empieza
    justo debajo de esa fila, con `alignItems: 'start'` para que la
    card lateral quede a la misma altura que las tarjetas de mob.
- `renderMobSnapshot3D.ts`: nueva constante `CAMERA_ZOOM` -- acerca la
  cámara hacia el centro de la geometría del mob (nunca hacia el
  origen del mundo, para que funcione igual de bien con la Araña, cuyo
  bounding box está en otra posición) mantieniendo el mismo ángulo de
  vista, solo reduce la distancia. Afinado en vivo contra los 4 mobs
  reales.

## Criterios de aceptación (TDD)
- Dado el panel lateral de "Proyecto", cuando lo veo, entonces
  "Información del proyecto" y "Acciones" se ven como UNA sola card con
  fondo visible (no transparente/igual al fondo de la pantalla) y un
  separador entre ambas secciones.
- Dado el buscador y el toggle grid/lista, cuando los veo, entonces
  están alineados con el borde derecho de la card lateral (no solo con
  el borde derecho de la columna de mobs).
- Dada la card lateral, cuando la veo, entonces empieza a la misma
  altura que las tarjetas de mob (no más arriba).
- Dada la miniatura 3D de un mob, cuando la veo, entonces se ve
  notablemente más grande que antes, sin recortar cabeza/pies de
  ningún mob real (Esqueleto/Zombie/Araña/Creeper).
- Verificación visual en vivo (Claude in Chrome), dark y light theme,
  grid y lista, modal de vista previa ampliada.

## Hecho

- `Proyecto.tsx`: "Información del proyecto" + "Acciones" fusionadas en
  un solo `<Section style={{ background: 'var(--surface-raised)' }}>`
  con 2 sub-encabezados (`<h3 className="ui-section__title">`) y un
  separador de 1px entre ambos; el encabezado "Mobs de este proyecto
  (N)" + el buscador/toggle salieron de la grid de 2 columnas a su
  propia fila de ancho completo, arriba de esa grid (`alignItems:
  'start'` ya alineaba las columnas -- el problema real era que el
  buscador antes solo ocupaba el ancho de la columna de mobs).
- `renderMobSnapshot3D.ts`: `CAMERA_ZOOM = 0.75` -- probado en vivo
  primero con `0.62` (mobs mucho más grandes, pero el Esqueleto/Zombie
  quedaban con los pies recortados fuera del cuadro), ajustado a
  `0.75` tras verificar los 4 mobs reales uno por uno (ningún recorte,
  mobs notablemente más grandes que antes).
- Verificación: `npx tsc --noEmit`, `npx oxlint`, `npm run build`
  limpios; `npx vitest run` -- 215/215 tests en verde (ticket 100%
  visual, sin lógica nueva que testear -- el ajuste de cámara no tenía
  un test unitario previo que actualizar, mismo criterio del ticket
  062: la construcción de escena/cámara 3D se verifica en vivo, no con
  test unitario). Verificación visual en vivo (Claude in Chrome) contra
  el proyecto real "Set Nether" (4 mobs): card lateral unificada con
  fondo visible, buscador/toggle alineados a la derecha de la card
  lateral, card lateral a la misma altura que las tarjetas de mob,
  ningún mob recortado en grid/modal ampliado -- dark theme, list mode,
  sin errores de consola.
