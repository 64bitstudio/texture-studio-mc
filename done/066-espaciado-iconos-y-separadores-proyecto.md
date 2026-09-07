# 066 — Más espacio en textos, iconos en "Información del proyecto", separador bajo breadcrumb, sin separador sobre "Eliminar"

## Objetivo
Ronda de ajustes de Marco sobre `Proyecto.tsx`/`MobEntryCard.tsx`.
Pedido textual: "los textos de las cards de los mobs y de informacion
del proyecto estan muy juntos, espacialos mas, ademas en acciones la
parte de eliminar el proyecto tiene un separador arriba, quitalo y por
ultimo agrega iconos al nombre, mobs y ultima modificacion de
informacion del proyecto, tambien debajo del breadcrumb pon un
separador, ah casi lo olvido, el nombre en la card de los mobs debe ir
hasta arriba pegada del lado izquierdo".

## Alcance
- `components/MobEntryCard.tsx`: más espacio entre el nombre y el
  bloque de info (gap 8 -> 14) y entre cada línea de info (gap 4 -> 7).
- `components/Proyecto.tsx`:
  - `dl` de "Información del proyecto": más espacio entre filas (gap 8
    -> 14) + un ícono por fila (`IconDocument`/Nombre,
    `IconModel`/Mobs, `IconClock`/Última modificación -- mismo criterio
    hand-drawn ya usado en `MobEntryCard.tsx`).
  - Se quita el separador que había arriba de "Eliminar proyecto"
    dentro de "Acciones".
  - Nuevo separador de 1px debajo del breadcrumb.

## Qué NO hace este ticket
- El nombre del mob en su tarjeta (modo grid) ya estaba pegado hasta
  arriba y a la izquierda desde el ticket 059/061 (primer elemento de
  su columna, `alignItems: 'flex-start'`) -- se verificó en vivo que
  sigue así tras aumentar el espaciado interno, sin necesidad de
  cambiar el layout.

## Criterios de aceptación (TDD)
- Dado el bloque de info de una tarjeta de mob, cuando lo veo, entonces
  hay separación visible entre cada línea.
- Dado el panel "Información del proyecto", cuando lo veo, entonces
  cada fila (Nombre/Mobs/Última modificación) tiene más espacio entre
  sí y un ícono junto a su etiqueta.
- Dado "Acciones", cuando veo "Eliminar proyecto", entonces ya no hay
  un separador arriba de ese botón.
- Dado el breadcrumb, cuando lo veo, entonces hay un separador visible
  debajo.
- Verificación visual en vivo (Claude in Chrome), dark y light theme.

## Hecho

- `MobEntryCard.tsx`: gap del bloque nombre+info de 8 a 14; gap interno
  de las 4 líneas de info de 4 a 7.
- `Proyecto.tsx`: `dl` de "Información del proyecto" con gap de 8 a 14
  y un ícono por `<dt>` (`IconDocument`/`IconModel`/`IconClock`);
  separador quitado de arriba de "Eliminar proyecto"; nuevo separador
  de 1px entre el breadcrumb y el resto del header.
- Verificación: `npx tsc --noEmit`, `npx oxlint`, `npm run build`
  limpios; `npx vitest run` -- 215/215 tests en verde (ticket 100%
  visual/estilo, sin lógica nueva). Verificación visual en vivo (Claude
  in Chrome) contra el proyecto real "Set Nether": espaciado visible en
  ambos lugares, iconos junto a Nombre/Mobs/Última modificación, sin
  separador sobre "Eliminar proyecto", separador visible bajo el
  breadcrumb, nombre de mob confirmado pegado arriba-izquierda -- dark
  y light theme, sin errores de consola.
