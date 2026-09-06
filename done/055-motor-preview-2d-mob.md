# 055 — Motor de preview 2D "de frente" de un mob

## Objetivo
Primera pieza del rediseño de "Proyecto" definido en
`docs/definiciones/preview-2d-y-rediseno-proyecto.md` (VoBo de Marco
obtenido): construir el motor que compone una silueta 2D "de frente" de
un mob a partir de su textura real guardada, reusando el mapeo UV
"cross" ya calculado (`computeBoxFaceRects`, `geometry/applyBoxUV.ts`)
en vez de mostrar la hoja de textura plana o un ícono genérico. Este
ticket construye y verifica el motor en aislado -- los tickets 056/057
son quienes lo integran a la UI real de "Proyecto".

## Alcance
- Nueva función pura (ej. `frontend/src/geometry/renderMobFront2D.ts`)
  que reciba la geometría (`MobGeometry`) + los píxeles de la textura
  (`TextureBuffer`/`ImageData` ya decodificada) y devuelva una imagen 2D
  (canvas/`ImageData`/data URL) con la silueta del mob de frente:
  - Por cada `MobBoxPart`, toma el rect `front` de `computeBoxFaceRects`
    (aplicando `mirrorX` igual que `applyBoxUV`).
  - Proyecta la posición 3D a 2D: `x = position[0]`, `y = -position[1]`
    (Y de Minecraft crece hacia arriba, canvas hacia abajo), sin usar
    profundidad para la posición.
  - Ordena el dibujado por `position[2]` (de más lejos a más cerca) para
    que las partes más cercanas oculten correctamente a las de atrás.
  - `imageSmoothingEnabled = false` (mismo criterio pixel-art del resto
    de la app).
- Partes con `pivot`/`rotation` (hoy solo las patas de la Araña, ticket
  024): se dibujan en su posición de reposo, SIN aplicar la rotación en
  2D -- limitación conocida y aceptada explícitamente en el documento de
  definición (ver "Riesgos y preguntas abiertas").
- Cache simple por `(pngDataUrl, geometry)` -- no se debe recalcular en
  cada render de React si la textura no cambió (usar dentro de un
  `useMemo`/hook cuando se integre en 056/057, pero la función en sí es
  pura y no sabe de React).
- Integración mínima de prueba: usar esta función en AL MENOS un lugar
  visible ya existente (ej. reemplazar temporalmente la miniatura de
  `Proyecto.tsx` actual, que hoy muestra `pngDataUrl` crudo) para
  verificar en vivo que el resultado se ve como un personaje reconocible
  antes de que 056/057 construyan la UI nueva alrededor.
- Tests unitarios de la función pura (sin DOM real -- mockear un
  contexto 2D mínimo o verificar la estructura de las llamadas de
  dibujado, mismo criterio de testabilidad que `applyBoxUV.spec.ts` si
  existe, o `symmetry.spec.ts`).

## Qué NO hace este ticket
- No construye ningún layout nuevo de "Proyecto" (breadcrumb, portada,
  panel de acciones, etc.) -- eso es el ticket 056.
- No construye las tarjetas de mob rediseñadas ni el modal de preview
  ampliado -- eso es el ticket 057.
- No corrige la rotación 2D de partes con pivote (arañas) -- limitación
  conocida, ver documento de definición.

## Criterios de aceptación (TDD)
- Dado un `TextureBuffer` con contenido real y la `MobGeometry` de un
  mob, cuando llamo a la función del motor, entonces obtengo una imagen
  2D donde cada parte del cuerpo aparece en su posición relativa
  correcta (cabeza arriba del cuerpo, piernas abajo, etc.).
- Dado un mob con partes `mirrorX` (ej. layout 64x32 clásico), entonces
  la miniatura 2D refleja esas partes igual que el visor 3D.
- Dado que integro el motor en un lugar visible existente, cuando lo
  veo en Claude in Chrome, entonces reconozco visualmente la silueta del
  mob (no una hoja de texturas plana ni un bloque de píxeles sin
  sentido).
- Tests unitarios en verde.

## Hecho

Implementado tal como se definió. Todos los criterios de aceptación
cumplidos y verificados en vivo (Claude in Chrome, proyecto real de 4
mobs) salvo la limitación de la Araña, que era conocida y aceptada
DESDE el documento de definición (no un hallazgo sorpresa).

- `frontend/src/geometry/mobFrontSprite.ts` (nuevo, puro):
  `computeMobFrontSpriteLayout(geometry)` -- reusa `computeBoxFaceRects`
  ya existente, sin duplicar la fórmula del "cross" UV.
- `frontend/src/renderMobFrontSprite2D.ts` (nuevo, DOM): dibuja el
  layout sobre un `<canvas>` real, escala por `resolution`.
- `frontend/src/hooks/useMobFrontSprite2D.ts` (nuevo): hook memoizado.
- `frontend/src/components/Proyecto.tsx`: integración mínima de prueba
  (`MobThumbnail2D`) -- reemplaza la textura cruda por el sprite 2D, con
  fallback mientras carga.
- `frontend/test/mobFrontSprite.spec.ts`: 5 tests nuevos (una caja,
  biped completo, `mirrorX`→`flipX`, orden de profundidad, verificación
  de que el rect de origen viene de `computeBoxFaceRects`).

**Hallazgo real durante la implementación** (oxlint
`react/set-state-in-effect`, no relacionado al alcance del ticket):
tanto `useMobFrontSprite2D` como `MobThumbnail2D` llamaban `setState`
sincrónicamente dentro de un efecto para casos que en realidad se
podían derivar directamente durante el render -- corregido en ambos
(ver `docs/ARQUITECTURA.md`, "Ticket 055").

**Limitación confirmada en vivo, ya documentada como aceptada**: la
Araña (8 patas con `pivot`/`rotation`, dibujadas sin rotar) se ve como
una franja delgada a los lados del cuerpo, no una araña reconocible.
Marco puede pedir la mejora incremental (rotación 2D real) como ticket
aparte si al verlo en el deploy real lo considera necesario -- no
bloquea el cierre de este ticket, que explícitamente aceptó esta
limitación de antemano.

Tests: 206 pasan (201 + 5 nuevos). `npx tsc --noEmit`, `npm run lint`,
`npm run build` en verde.
