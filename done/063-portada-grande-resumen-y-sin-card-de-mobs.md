# 063 — Portada más grande, resumen de mobs/fecha bajo el título, zona de mobs sin card envolvente

## Objetivo
Ronda de ajustes visuales de Marco sobre `Proyecto.tsx`, con 4 imágenes
de referencia (portada actual vs. esperada, layout actual vs.
esperado). Pedido textual: "podrias hacer la imagen del proyecto mas
grande (120px)... tambien agregale el texto del numero de mobs y la
fecha de ultima modificacion, por otra parte... la distribucion para
mostrar los mobs es diferente... el formulario de busqueda y los
botones para cambiar entre lista y cuadricula estan fuera de la card
donde se muestra todo, aparte la card donde estan los mobs no debe
estar realmente, solo se muestran las cards de los mobs y las cards de
informacion del proyecto y acciones, iguala el diseno".

## Alcance
- `components/Proyecto.tsx`:
  - Portada del proyecto: 88px -> 120px (botón + ícono placeholder a
    juego).
  - Nueva línea "N mobs · Última modificación: fecha" debajo del
    título (antes de la descripción) -- mismo formato ya usado por
    `ProjectCard.tsx` en "Mis proyectos" (singular/plural, separador
    "·").
  - La zona de mobs deja de estar envuelta en un `<Section>` (caja con
    borde/fondo propio): el buscador + el toggle grid/lista salen de
    esa caja (ahora comparten fila con el encabezado "Mobs de este
    proyecto (N)"), y el grid/lista de tarjetas de mob queda "suelto"
    sobre el fondo de la pantalla, sin card envolvente. Las ÚNICAS
    cards reales que quedan en la pantalla son "Información del
    proyecto" y "Acciones" (columna derecha, sin cambios) y las
    tarjetas de cada mob.

## Qué NO hace este ticket
- NO agrega pestañas "Mobs y texturas" / "Configuración del proyecto"
  -- una de las imágenes de referencia las muestra, pero "Configuración
  del proyecto" fue explícitamente descartada en la fase de definición
  del ticket 056 (sin contenido real que mostrar todavía). Lo que sí es
  accionable y sin ambigüedad de esa imagen (buscador/toggle fuera de
  la card, sin card envolviendo los mobs) se implementa; las pestañas
  no.

## Criterios de aceptación (TDD)
- Dado el header de "Proyecto", cuando lo veo, entonces la portada mide
  120px y hay una línea "N mobs · Última modificación: fecha" entre el
  título y la descripción.
- Dado el buscador y el toggle grid/lista de mobs, cuando los veo,
  entonces NO están dentro de una caja con borde/fondo -- comparten
  fila con el encabezado "Mobs de este proyecto (N)".
- Dado el grid/lista de tarjetas de mob, cuando lo veo, entonces no
  tiene una card envolvente (sin borde/fondo propio alrededor de todo
  el grupo) -- solo las tarjetas individuales de cada mob se ven como
  cards.
- Verificación visual en vivo (Claude in Chrome), dark y light theme,
  grid y lista, y el estado "ningún mob coincide con la búsqueda".

## Hecho

- `Proyecto.tsx`: portada de 88px a 120px (ícono placeholder de 28 a
  38); nueva línea de resumen "{N} mob(s) · Última modificación:
  {fecha}" debajo del título/antes de la descripción
  (`new Date(record.updatedAt).toLocaleString()`, mismo criterio de
  singular/plural que `ProjectCard.tsx`); la zona de mobs se
  reestructura -- el `<Section>` que envolvía buscador+toggle+grid se
  reemplaza por un `<div>` sin borde/fondo, con un encabezado
  (`<h3 className="ui-section__title">`) en la misma fila que el
  buscador/toggle (el buscador+toggle solo se muestran si hay al menos
  1 mob, mismo criterio que antes).
- Verificación: `npx tsc --noEmit`, `npx oxlint`, `npm run build`
  limpios; `npx vitest run` -- 215/215 tests en verde (ticket 100%
  visual/estilo, sin lógica nueva que testear). Verificación visual en
  vivo (Claude in Chrome) contra el proyecto real "Set Nether" (4
  mobs): portada más grande, línea de resumen visible, buscador/toggle
  sin caja envolvente, grid y lista sin card alrededor del grupo
  completo, estado "ningún mob coincide con la búsqueda" sin romper el
  layout -- dark y light theme, sin errores de consola.
