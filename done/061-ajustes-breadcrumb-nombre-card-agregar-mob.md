# 061 — Corrección de espaciado del breadcrumb, nombre de tarjeta más grande, subtítulo en "Agregar mob"

## Objetivo
Corrección directa de Marco sobre el ticket 060: el espaciado del
breadcrumb que se implementó ahí (padding vertical) no era lo pedido —
lo que faltaba era espacio horizontal entre cada texto y el separador
"›". Aprovecha el mismo ciclo para dos ajustes más, chicos y sin
ambigüedad, sobre `MobEntryCard.tsx`/`Proyecto.tsx`.

Pedido textual de Marco: "el espaciado del breadcrumb esta mal, no lo
explique bien, no era espaciado de arriba hacia abajo, era espaciado
entre los textos y el icono >, el texto del nombre de la card debe ir
hasta arriba y ligeramente mas grande, en la card de agregar mob,
agregale el texto abajo 'Añade un nuevo mob a este proyecto.'".

## Alcance
- `components/Proyecto.tsx`:
  - Breadcrumb ("Mis proyectos › Nombre"): revertir el padding vertical
    del ticket 060 (no era lo pedido) y agregar espacio horizontal real
    entre "Mis proyectos", "›" y el nombre del proyecto (`gap` en flex
    en vez de espacios literales dentro del texto).
  - Card "Agregar mob" (modo grid): nuevo subtítulo "Añade un nuevo mob
    a este proyecto." debajo del título.
- `components/MobEntryCard.tsx`:
  - Nombre del mob en la tarjeta (modo grid): confirmar que está pegado
    hasta arriba (ya lo estaba) y subir el tamaño de fuente un nivel
    (`--font-sm` -> `--font-md`).

## Qué NO hace este ticket
- NO cambia la perspectiva del motor de preview 2D. Marco adjuntó una
  imagen de referencia en este mismo mensaje, pero no llegó legible
  (el marcador de adjunto no trajo contenido visible, y el archivo de
  captura de pantalla temporal referenciado ya no existe en disco —
  visto al intentar leerlo). Se le pidió a Marco reenviarla por un
  medio que sí persista el archivo (pegar la imagen directo en el
  chat/arrastrar y soltar, no una captura de pantalla temporal del
  sistema). Este punto se aborda en un ticket aparte una vez que la
  imagen sea visible de verdad.

## Criterios de aceptación (TDD)
- Dado el breadcrumb "Mis proyectos › Nombre", cuando lo veo, entonces
  hay espacio visible entre cada texto y el separador "›" (no depende
  de espacios literales dentro del string).
- Dado el nombre de un mob en su tarjeta (modo grid), cuando lo veo,
  entonces está pegado hasta arriba de la tarjeta y es notablemente más
  grande que la info debajo de él.
- Dado la tarjeta "Agregar mob" (modo grid), cuando la veo, entonces
  tiene el subtítulo "Añade un nuevo mob a este proyecto." debajo del
  título.
- Verificación visual en vivo (Claude in Chrome), dark y light theme.

## Hecho

- `Proyecto.tsx`: breadcrumb reescrito como flex con `gap: 10` en vez
  de padding vertical + espacios literales dentro del texto; el
  separador "›" es su propio `<span aria-hidden="true">`.
- `Proyecto.tsx`: card "Agregar mob" (modo grid) gana el subtítulo
  "Añade un nuevo mob a este proyecto." (`--font-xs`); el título gana
  `fontWeight: 600` para diferenciarse del subtítulo. En modo lista no
  se agregó (es una barra angosta, no una "card").
- `MobEntryCard.tsx`: nombre del mob en modo grid de `--font-sm` (13px)
  a `--font-md` (14px); ya estaba pegado hasta arriba (primer elemento
  de la columna, `alignItems: 'flex-start'` en la fila contenedora) —
  sin cambio de layout ahí, solo se confirmó en vivo.
- Verificación: `npx tsc --noEmit`, `npx oxlint`, `npm run build`
  limpios; `npx vitest run` -- 220/220 tests en verde (ticket 100%
  visual/estilo, sin lógica nueva). Verificación visual en vivo (Claude
  in Chrome) contra el proyecto real "Set Nether", dark y light theme
  -- sin errores de consola.
- Hallazgo real (no un bug, una limitación del canal): la imagen de
  referencia para la "perspectiva 2D" que Marco adjuntó en el mismo
  mensaje no llegó legible -- el archivo de captura de pantalla
  temporal ya no existía en disco al intentar leerlo. Se le reportó
  explícitamente y se le pidió reenviarla por un medio que persista
  (pegar directo en el chat, no una captura de pantalla del sistema
  operativo que se autolimpia). Ese punto queda para un ticket aparte
  (062) una vez que la imagen sea visible de verdad -- no se asumió
  ninguna interpretación de "la misma perspectiva".
