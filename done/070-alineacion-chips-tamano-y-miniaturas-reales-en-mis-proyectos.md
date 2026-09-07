# 070 — Alineación de íconos, chips de info, tarjetas más chicas, miniaturas reales en "Mis proyectos"

## Objetivo
Ronda de ajustes de Marco sobre "Proyecto"/"Mis proyectos", revisados
uno por uno con captura/artifact antes de tocar rama o PR (nueva regla
de flujo, ver memoria `texture-studio-mc-vobo-antes-de-pr`) -- VoBo
explícito de Marco ("doy vobo") recibido para el conjunto completo.

Pedidos textuales, en orden:
1. "en estos divs aplica align-items: center" (con captura de
   DevTools señalando los 4 divs de "Información del proyecto").
2. "esos textos de las cards hazlos como chips tipo esto" (con imagen
   de referencia del badge "Minecraft Java Edition").
3. "alinealos uno al lado del otro" (los chips, antes en columna).
4. "las tarjetas de los mobs... ocupan mucho espacio
   innecesariamente, hazlas mas pequenas".
5. "para la vista Mis proyectos, necesito que apliques la misma
   tecnica del render 2D con la perspectiva que tomamos anteriormente
   para los mobs que se visualizan".

## Alcance
- `components/Proyecto.tsx`: los 4 divs de fila de "Información del
  proyecto" (Nombre/Mobs/Última modificación/Descripción) cambian de
  `alignItems: 'flex-start'` a `'center'`.
- `components/MobEntryCard.tsx`:
  - Cada línea de info (archivo/dimensiones/escala/modelo) pasa a ser
    un chip (`background: var(--chip-bg)`, `borderRadius: 10`,
    padding) -- mismo estilo que el badge "Minecraft Java Edition".
  - Los chips pasan de columna a fila (`flexWrap: 'wrap'`).
  - Tarjeta (modo grid) más chica: `padding`/`gap` del `<li>` de
    20/18 a 14/12; miniatura de 200px a 140px de alto.
  - Refactor: la lógica de fetch+cache de geometría (antes inline) se
    extrae al nuevo hook compartido `hooks/useMobGeometry.ts`, para
    reusarla también en `ProjectCard.tsx` (punto 5) sin duplicarla.
- `components/Proyecto.tsx`: columna mínima del grid de mobs de 320px
  a 240px (a juego con la tarjeta más chica).
- `components/ProjectCard.tsx`/`components/MisProyectos.tsx`: las
  miniaturas de cada proyecto en "Mis proyectos" (hasta 3 + badge
  "+N") dejan de ser el ícono vanilla fijo (`MOB_ICONS[mobId]`) -- pasan
  a fotografiar la textura REAL guardada en cada proyecto con el mismo
  motor 3D del ticket 062 (`renderMobSnapshot3D.ts`, vía el nuevo
  componente `ProjectMobThumb`), en el mismo ángulo "estilo wiki".
  `MisProyectos.tsx` crea una `geometryCache` compartida (mismo
  criterio del ticket 055) y se la pasa a cada `ProjectCard`.
  `ProjectCard` lee `loadProject(project.name)` para tener el
  `pngDataUrl` real de cada mob visible (con fallback al ícono vanilla
  si el registro/mob ya no existe, caso borde).

## Hallazgo técnico señalado a Marco (no es un bug, es un tradeoff)
`listProjects()` (usado por `MisProyectos.tsx` para listar todos los
proyectos) sigue siendo deliberadamente liviano -- no decodifica
ningún PNG. Pero ahora cada `ProjectCard` SÍ hace su propia lectura
completa del proyecto (`loadProject`) para sus hasta 3 miniaturas
visibles -- con pocos proyectos no hay impacto notable; con muchos
proyectos guardados podría notarse. Aceptado explícitamente por Marco
como parte de este VoBo; queda documentado para revisar si algún día
se vuelve un problema real.

## Criterios de aceptación (TDD)
- Dado el panel "Información del proyecto", cuando lo veo, entonces
  los íconos quedan centrados verticalmente contra su bloque de
  etiqueta+valor.
- Dada la info de una tarjeta de mob (modo grid), cuando la veo,
  entonces cada línea es un chip con fondo, alineados uno al lado del
  otro (con wrap si no caben).
- Dada una tarjeta de mob (modo grid), cuando la veo, entonces es
  notablemente más chica que antes (menos padding, miniatura más baja,
  más tarjetas por fila).
- Dada una tarjeta de proyecto en "Mis proyectos", cuando la veo,
  entonces sus miniaturas de mob muestran la textura real de ESE
  proyecto (no el ícono vanilla genérico), en la misma perspectiva que
  usa "Proyecto".
- Verificación visual en vivo (Claude in Chrome), dark y light theme,
  grid y lista.

## Hecho

- `Proyecto.tsx`: `alignItems: 'center'` en los 4 divs de info; grid
  de mobs con columna mínima de 240px.
- `MobEntryCard.tsx`: info como chips en fila (con wrap); tarjeta
  (modo grid) con padding/gap/miniatura reducidos; geometría movida al
  hook compartido `useMobGeometry.ts`.
- `hooks/useMobGeometry.ts` (nuevo): fetch+cache de geometría de un
  mob, extraído de `MobEntryCard.tsx` para reusarlo en
  `ProjectCard.tsx` sin duplicar lógica.
- `ProjectCard.tsx`: nuevo subcomponente `ProjectMobThumb` -- miniatura
  real por proyecto vía `useMobGeometry`/`useMobSnapshot3D`, con
  fallback a `MOB_ICONS` si el mob/registro no existe.
- `MisProyectos.tsx`: nueva `geometryCache` compartida, pasada a cada
  `ProjectCard`.
- Verificación: `npx tsc --noEmit`, `npx oxlint`, `npm run build`
  limpios; `npx vitest run` -- 215/215 tests en verde (ticket 100%
  visual/de datos derivados, sin lógica de negocio nueva que testear
  aparte). Verificación visual en vivo (Claude in Chrome) contra el
  proyecto real "Set Nether" en cada paso -- capturas enviadas a Marco
  y VoBo explícito recibido antes de este commit -- dark y light theme,
  grid y lista, sin errores de consola.
