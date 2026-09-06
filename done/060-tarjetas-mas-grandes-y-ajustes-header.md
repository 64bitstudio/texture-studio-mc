# 060 — Tarjetas de mob más grandes, orden de botones, íconos de edición sin caja, breadcrumb más espaciado

## Objetivo
Ronda de ajustes visuales de Marco sobre `MobEntryCard.tsx`/`Proyecto.tsx`
(tickets 057-059). Parte del pedido depende de una imagen de referencia
que no llegó en el mensaje (perspectiva del render 2D) -- ESE punto
queda pendiente de una imagen nueva, ver "Qué NO hace este ticket". El
resto es accionable sin ambigüedad y se hace en este ticket.

Pedido textual de Marco: "las cards deben ser mas grandes y tambien los
renders 2D de cada textura... tambien el boton de vista previa debe
estar del lado derecho y la previsualizacion debe tener la perspectiva
que te mencione antes y el tamano debe ser mas grande, por otra parte
el nombre del proyecto y la descripcion tienen un boton de edicion,
pero debe ser solo el icono sin el cuadro que lo envuelve, aparte la
seccion de hasta arriba que dice mis proyectos > nombre del proyecto
debe estar mas espaciada".

## Alcance
- `components/MobEntryCard.tsx`:
  - Tarjeta más grande en modo grid (más padding, columnas del grid con
    un mínimo mayor en `Proyecto.tsx`) y miniatura 2D más grande (96px
    -> más grande, ej. 160px).
  - Orden de los botones: "Editar textura" primero (izquierda), "Vista
    previa" (ícono de ojo) después (derecha) -- hoy es al revés.
  - Modal de vista previa ampliada: más grande (256px de caja -> más
    grande).
- `components/Proyecto.tsx`:
  - Botones de editar título/descripción: hoy usan `variant="icon-square"`
    (caja cuadrada con fondo/borde) -- deben ser SOLO el ícono, sin caja
    que lo envuelva (mismo ícono, sin el fondo/borde de
    `.ui-button--icon-square`).
  - Breadcrumb ("Mis proyectos › Nombre"): más espaciado -- separación
    vertical/padding respecto al resto del header.

## Qué NO hace este ticket
- NO cambia la perspectiva del motor de preview 2D (`renderMobFrontSprite2D.ts`/
  `mobFrontSprite.ts`) -- Marco pidió que el render tenga "la misma
  perspectiva" que una imagen de referencia que no llegó adjunta en su
  mensaje. Este es potencialmente un cambio de arquitectura real del
  motor (hoy es una proyección ortográfica de frente; si la referencia
  muestra una vista isométrica/3-cuartos como los renders oficiales ya
  usados en `mobIcons.ts`, sería un compositor bastante más complejo,
  no un ajuste de tamaño). Queda pendiente de que Marco reenvíe la
  imagen -- se hace como ticket aparte una vez confirmada.

## Criterios de aceptación (TDD)
- Dado una tarjeta de mob en modo grid, cuando la veo, entonces es
  notablemente más grande que antes, con una miniatura 2D más grande.
- Dado los botones de una tarjeta, cuando los veo, entonces "Editar
  textura" está a la izquierda y el ícono de "Vista previa" a la
  derecha.
- Dado que abro el modal de vista previa, entonces la imagen se ve más
  grande que antes.
- Dado los botones de editar título/descripción en "Proyecto", cuando
  los veo, entonces son solo el ícono, sin caja/fondo alrededor.
- Dado el breadcrumb "Mis proyectos › Nombre", cuando lo veo, entonces
  tiene más espacio (padding/margen) respecto al contenido de abajo.
- Verificación visual en vivo (Claude in Chrome), dark y light theme.

## Hecho

- `MobEntryCard.tsx`: miniatura 2D en modo grid de 96px a 160px, padding
  de la tarjeta de 14px a 20px y gap de 10px a 14px; orden de botones
  invertido ("Editar textura" primero/izquierda, ícono de ojo después/
  derecha) en ambos layouts (grid y lista); modal de vista previa
  ampliada de 256px/230px a 340px/310px.
- `ui/Button.tsx` + `index.css`: nuevo `variant="icon-plain"` (mismo
  nombre accesible vía `.sr-only` que `icon-square`, pero SIN fondo/
  borde/caja) -- usado en los botones de renombrar proyecto y editar
  descripción de `Proyecto.tsx`, que antes usaban `icon-square`.
- `Proyecto.tsx`: columna mínima del grid de tarjetas de mob de 220px a
  320px (a juego con la tarjeta más grande, incluida la tarjeta
  "Agregar mob" que también crece su `minHeight`); breadcrumb con
  padding vertical propio (antes dependía solo del `gap` del
  contenedor).
- Verificación: `npx tsc --noEmit`, `npx oxlint` y `npm run build`
  limpios; `npx vitest run` -- 220/220 tests en verde (19 archivos, sin
  tests nuevos: este ticket es 100% visual/estilo, sin lógica nueva que
  testear). Verificación visual en vivo (Claude in Chrome) contra el
  proyecto real "Set Nether" (4 mobs), dark y light theme, modo grid y
  lista, modal de preview ampliado -- sin errores de consola.
- Excluido explícitamente (confirmado con Marco, pendiente de que
  reenvíe la imagen de referencia): el cambio de perspectiva del motor
  de preview 2D. Ningún hallazgo nuevo del gate de QA automático
  pendiente al momento de escribir esto (se revisa de nuevo en el PR).
