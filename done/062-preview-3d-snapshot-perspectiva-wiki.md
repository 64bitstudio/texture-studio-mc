# 062 — Motor de preview: foto fija 3D con perspectiva "estilo wiki oficial"

## Objetivo
Marco mandó una imagen de referencia (adjunta correctamente esta vez,
ticket 061 había quedado bloqueado por un adjunto que no llegó
legible) mostrando que la miniatura de cada mob en su tarjeta debe
verse con perspectiva de 3/4 (frente + lado, con volumen/sombreado),
el mismo estilo que ya usan los íconos oficiales de la Minecraft Wiki
(`mobIcons.ts`, usados en "Selecciona un mob") -- no la vista de frente
completamente plana que generaba el compositor 2D del ticket 055.

Confirmado con Marco vía `AskUserQuestion` antes de tocar el motor de
renderizado: la solución reutiliza el MISMO motor 3D que ya usa el
editor en vivo (`Viewer3D.tsx`) para tomar una foto fija en ese ángulo
-- sigue siendo una imagen estática en la tarjeta (un `<img>`, sin
controles, sin rotación), solo cambia cómo se genera por dentro.

## Alcance
- Nuevo `renderMobSnapshot3D.ts`: dado `MobGeometry` + la textura del
  proyecto (data URL), monta una escena Three.js pura (sin
  react-three-fiber) con la MISMA geometría por cajas + UV clásico que
  `Viewer3D.tsx` (`applyBoxUV`, soporte de `pivot`/`rotation` para
  patas de Araña), el MISMO ángulo/FOV de cámara inicial
  (`[45, 40, 65]`, fov 40 -- el que ya usa el editor antes de tocar los
  controles orbitales), fondo transparente, y devuelve UNA foto (data
  URL PNG) vía un `WebGLRenderer` COMPARTIDO entre llamadas (evita
  agotar el límite de contextos WebGL del navegador si un proyecto
  tiene muchos mobs).
- Nuevo `useMobSnapshot3D.ts`: mismo patrón de memoización/cache que su
  predecesor (`useMobFrontSprite2D`, retirado), sin el parámetro
  `resolution` (ya no hace falta -- el motor 3D no escala su canvas de
  salida según la resolución de la textura de origen).
- `MobEntryCard.tsx`: consume el nuevo hook en vez del anterior.
- Retirado (reemplazado, ya no usado por nadie): `mobFrontSprite.ts`
  (compositor 2D puro), `renderMobFrontSprite2D.ts`, y
  `useMobFrontSprite2D.ts` + su test (`mobFrontSprite.spec.ts`).

## Qué NO hace este ticket
- NO reintroduce un visor 3D interactivo en la tarjeta -- sigue siendo
  una imagen estática (`<img>`), el cambio es puramente de cómo se
  genera esa imagen por dentro.
- NO agrega tests unitarios nuevos para `renderMobSnapshot3D.ts`: es
  lógica de construcción de escena/render WebGL, mismo criterio ya
  establecido en este repo para `Viewer3D.tsx`/`MobPartMesh` (tampoco
  tienen test unitario, se verifican en vivo) -- lo único puro y
  testeable de ese archivo (`computeGeometryCenter`, mapeo UV) ya tenía
  test propio antes de este ticket y se sigue reusando tal cual.

## Criterios de aceptación (TDD)
- Dado un proyecto con mobs, cuando veo sus tarjetas, entonces cada
  miniatura muestra la textura real del proyecto aplicada al modelo 3D,
  en perspectiva de 3/4 (frente + lado visibles), no una vista de
  frente plana.
- Dado el modal de vista previa ampliada (ícono de ojo), cuando lo
  abro, entonces muestra la misma perspectiva, nítida, más grande.
- Dado el modo lista (miniaturas de 40px), cuando las veo, entonces
  siguen siendo legibles a ese tamaño.
- Verificación visual en vivo (Claude in Chrome) contra un proyecto
  real con los 4 mobs (Esqueleto/Zombie/Araña/Creeper), dark y light
  theme, grid y lista, navegando fuera y de vuelta a la pantalla (para
  confirmar que el renderer compartido sigue funcionando tras
  desmontar/remontar tarjetas).

## Hecho

- `renderMobSnapshot3D.ts` (nuevo): escena Three.js pura, geometría por
  cajas + UV clásico reusando `applyBoxUV`/`computeGeometryCenter` (las
  mismas utilidades puras que ya usaba `Viewer3D.tsx`, sin duplicar su
  lógica de UV), textura creada con los mismos sampler settings que
  `useCanvasTexture.ts` (`NearestFilter`, sin mipmaps, `colorSpace`
  sRGB explícito), cámara fija en el mismo ángulo/FOV que el editor,
  `WebGLRenderer` compartido a nivel de módulo (evita agotar contextos
  WebGL), fondo transparente, salida cuadrada de 512px.
- `useMobSnapshot3D.ts` (nuevo): mismo patrón de memoización que su
  predecesor, sin `resolution`.
- `MobEntryCard.tsx`: consume el nuevo hook; variable/prop renombrada
  de `spriteUrl` a `snapshotUrl` en todo el archivo (ya no es un
  "sprite" 2D, es una foto de una escena 3D); comentarios desactualizados
  corregidos.
- Retirados (nada más los usaba, confirmado por búsqueda antes de
  borrar): `mobFrontSprite.ts`, `renderMobFrontSprite2D.ts`,
  `useMobFrontSprite2D.ts`, `mobFrontSprite.spec.ts` (5 tests menos en
  la suite total, esperado).
- Verificación: `npx tsc --noEmit`, `npx oxlint`, `npm run build`
  limpios; `npx vitest run` -- 215/215 tests en verde (18 archivos, 5
  menos que antes por los tests retirados junto con el módulo que
  probaban). Verificación visual en vivo (Claude in Chrome) contra el
  proyecto real "Set Nether" (Araña/Creeper/Esqueleto/Zombie): las 4
  miniaturas muestran la perspectiva de 3/4 correcta, con la textura
  real del proyecto (no la vanilla), en grid, lista, modal ampliado,
  dark y light theme, y tras navegar fuera y de vuelta a la pantalla
  (confirma que el `WebGLRenderer` compartido sigue funcionando en
  remounts) -- sin errores de consola en ningún caso.
