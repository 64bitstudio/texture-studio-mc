# 009 — Corregir geometría del Esqueleto + generalizar dimensiones de textura + resolución escalable (x1-x10)

## Objetivo
Sale de feedback directo de Marco tras ver el MVP desplegado: el modelo 3D no se parece al del juego (brazos/piernas gruesos, como un Steve/zombie genérico), las dimensiones de textura (64×32) están hardcodeadas en varios puntos del frontend, y hace falta poder trabajar a una resolución más alta que la vanilla (64×32 nativo) para mayor calidad de detalle.

## Investigación / fuente de verdad
- **Causa raíz confirmada**: `backend/src/geometry/skeletonGeometry.ts` usa `size [4,12,4]` para brazos y piernas (proporción de Steve/humanoide estándar) cuando el Esqueleto real de Minecraft usa huesos delgados de `size [2,12,2]`.
- **Verificado contra dos fuentes independientes**:
  1. [`Mojang/bedrock-samples/resource_pack/models/entity/skeleton.geo.json`](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/skeleton.geo.json) (repo oficial y público de Mojang para creadores de add-ons): `right_arm`/`left_arm`/`right_leg`/`left_leg` = `size [2,12,2]`; brazos con origen `x=∓5` (no `∓6`), piernas con origen `x=∓2` (esto último ya coincidía con lo implementado).
  2. **Verificación empírica pixel a pixel contra el `skeleton.png` vanilla real** ya cacheado (`~/tools/minecraft-texture-pack/vanilla-cache/skeleton.png`): el patrón de pixeles opacos en las columnas 0-7 (piernas) y 40-47 (brazos) coincide EXACTAMENTE con el cross UV que genera una caja de 2×12×2 en esos orígenes (8 columnas de ancho total, no 16) — confirma que el layout UV actual (que asumía cajas de 16×16) también estaba mal, no solo el grosor 3D.
- Cabeza (`8×8×8`) y torso (`8×12×4`) YA eran correctos — no tocar.

## Alcance

### 1. Corrección de geometría (`backend/src/geometry/skeletonGeometry.ts`)
- `armRight`/`armLeft`: `size` de `[4,12,4]` a `[2,12,2]`; `position.x` de `∓6` a `∓5`.
- `legRight`/`legLeft`: `size` de `[4,12,4]` a `[2,12,2]`; posición sin cambios.
- El UV cross se recalcula solo (ya se computa proceduralmente en `frontend/src/geometry/applyBoxUV.ts` a partir del tamaño de la caja — no hardcodear el nuevo tamaño de cross ahí).
- Documentar el método de verificación (fuente oficial + verificación empírica contra el PNG real) en `docs/ARQUITECTURA.md`, para que sea el procedimiento estándar a seguir con cualquier mob futuro (no solo el esqueleto).

### 2. Generalizar dimensiones de textura (quitar hardcodes de 64×32)
- Auditar `frontend/src/` (`textureBuffer.ts`, `zoom.ts`, `symmetry.ts`, `importImage.ts`, `export.ts`/`exportPack.ts`, componentes) por cualquier `64`/`32` hardcodeado y reemplazarlo por el `textureWidth`/`textureHeight` que ya devuelve `GET /api/base-assets/skeleton` (`SKELETON_GEOMETRY.textureWidth/Height` en el backend). Un mob futuro con otra proporción de textura no debe requerir tocar estos módulos.

### 3. Resolución de trabajo escalable (x1 a x10)
- Selector en la UI para trabajar a una resolución múltiplo de la nativa del mob: x1 (64×32 nativo para el Esqueleto), x2 (128×64), x3, x4, x5, x6... hasta x10 (640×320) — para más detalle al pintar.
- Al cambiar el multiplicador, el `TextureBuffer` se re-muestrea (nearest-neighbor, nunca interpolación suave — cada pixel original se convierte en un bloque N×N al escalar hacia arriba; al escalar hacia abajo, promediar o tomar el pixel superior-izquierdo de cada bloque, tu elección, documenta cuál) preservando el contenido ya pintado — no se pierde el trabajo al cambiar de resolución.
- Las coordenadas UV de las cajas (y por tanto las regiones de simetría/pegado de imagen de tickets ya cerrados) deben escalar proporcionalmente al multiplicador activo — un pixel en la textura x4 corresponde a 1/4 de pixel en términos UV "nativos", no una coordenada distinta.
- Export (PNG/ZIP, ticket 006): exporta la textura a la resolución de trabajo actual (ej. 256×128 si está en x4) — esto es un resource pack HD válido en Minecraft (el juego solo exige que la proporción ancho:alto se mantenga idéntica a la nativa, no una resolución fija).
- Default al cargar la app: x1 (resolución nativa, la del asset vanilla real ya montado).

## Qué NO construir (fuera de este ticket)
- No implementes selección de mob (sigue siendo solo el Esqueleto) — el objetivo es que el CÓDIGO quede preparado para más mobs después, no agregar un segundo mob ahora.
- No optimices rendimiento para x10 más allá de lo razonable (640×320 = 204,800 pixeles, manejable en un `Uint8ClampedArray`/canvas 2D sin problema) — si algo se vuelve perceptiblemente lento en la verificación visual, repórtalo en vez de over-engineer una solución no pedida.

## Criterios de aceptación
- Dado el visor 3D, cuando se compara con una captura de referencia del Esqueleto vanilla real, entonces la silueta (grosor de brazos/piernas) coincide.
- Dado el selector de resolución, cuando se elige x4, entonces el editor pasa a trabajar sobre una cuadrícula de 256×128 sin perder lo ya pintado, y el modelo 3D sigue viéndose correcto (sin distorsión).
- Dado un export en cualquier resolución (x1 a x10), cuando se revisa el PNG resultante, entonces sus dimensiones son exactamente `textureWidth*N x textureHeight*N`.

## Hecho
Implementado por el agente `fullstack-dev` (PR [#19](https://github.com/64bitstudio/texture-studio-mc/pull/19)). CI de Jenkins en verde, sin hallazgos del gate de QA automático.

- Geometría corregida (`armRight`/`armLeft`/`legRight`/`legLeft` a `size [2,12,2]`, posición de brazos ajustada a x=∓5) — verificada contra `bedrock-samples` oficial de Mojang y empíricamente contra el PNG vanilla real.
- Auditoría de hardcodes: no se encontró ningún `64`/`32` real en lógica — el frontend ya derivaba todo de `textureWidth`/`textureHeight` desde tickets anteriores.
- Selector de resolución ×1 a ×10, con re-muestreo nearest-neighbor (downscale toma el pixel del centro de cada bloque) preservando el contenido pintado.
- Dos bugs reales de por medio encontrados y corregidos en el camino (documentados en `docs/ARQUITECTURA.md`): el canvas offscreen de `useCanvasTexture` no se redimensionaba al cambiar el tamaño del buffer, y un guard por `ref` rompía el doble-invoke de `<StrictMode>` dejando el modelo 3D en negro.
- **Verificado en vivo contra el deploy real de DEV** (el orquestador repitió la verificación tras el merge): el modelo 3D ya tiene la silueta correcta del Esqueleto vanilla (brazos/piernas delgados, ya no proporción Steve/zombie); cambiar de ×1 a ×4 (256×128) preserva exactamente un pixel de prueba pintado antes del cambio, escalado proporcionalmente a un bloque 4×4.
- Pendiente, explícitamente fuera de este ticket: regiones UV nombradas (011), aislar partes (012), pegado con ajuste automático (013) — el panel lateral redimensionable (010) es independiente y sigue en el backlog.
