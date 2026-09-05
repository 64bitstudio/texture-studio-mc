# Componentes — Texture Studio MC

## Frontend (`frontend/src/`)

Construidos en el ticket 001:

- **`App.tsx`** — orquesta el fetch de `GET /api/base-assets/skeleton` (estados `loading`/`error`/`ready`, con reintento) y renderiza `Editor` cuando el asset base está listo. Muestra un badge cuando la textura servida es el placeholder (`texture.isPlaceholder`). Layout: header fijo + área de contenido a pantalla completa (antes header absoluto superpuesto — se volvió flujo normal en el ticket 002 al aparecer el panel lateral del editor).
- **`geometry/applyBoxUV.ts`** — aplica el mapeo UV "cross" clásico de Minecraft sobre un `BoxGeometry`, incluyendo el `mirrorX` de brazo/pierna izquierdo. Ver `docs/ARQUITECTURA.md` para la derivación completa.
- **`api/baseAssets.ts`** — cliente `fetch` de `GET /api/base-assets/skeleton`.
- **`types/baseAssets.ts`** — espejo TypeScript del contrato del backend (ver `docs/API.md`; duplicación deliberada, sin paquete compartido en este ticket).

Construidos en el ticket 002 (editor de textura + sync en vivo con el 3D — HU-2, HU-3, HU-5):

- **`textureBuffer.ts`** — `TextureBuffer`: única interfaz de escritura sobre los pixeles editables (HU-12). Envuelve un `Uint8ClampedArray` RGBA de 64×32, deliberadamente sin dependencias de React/DOM/three.js salvo `toImageData()` (que sí requiere `ImageData` del navegador). API: `getPixel`/`setPixel` (fuera de rango es no-op seguro, nunca lanza), `paintLine` (interpola con `bresenhamLine` para el modo brocha — HU-2, sin saltarse celdas con movimientos rápidos del cursor), `loadFromImageData` (reemplaza todo el contenido in-place, usado para la carga inicial), `getRawData`/`toImageData`. Cualquier fuente futura de escritura (importar/pegar imagen del ticket 005, generación por IA de HU-12) debe escribir a través de esta misma interfaz, no acoplarse al manejo de eventos de mouse del editor. Es la única pieza con tests unitarios propios (ver `frontend/test/textureBuffer.spec.ts`) — el resto de componentes de este ticket son canvas/three.js, validados con revisión visual en vivo.
- **`colors.ts`** — `hexToRgba` (alpha fijo en 255 — ver decisión "Alpha fijo en 255" en `docs/ARQUITECTURA.md`) y `MINECRAFT_PALETTE` (16 swatches curados: hueso/piedra/madera/tierra/agua/metales/lana, etc.).
- **`decodeTexture.ts`** — `decodePngDataUrlToImageData`: decodifica el `data:image/png;base64,...` del backend a un `ImageData` de 64×32 vía un `<canvas>` offscreen + `Image`. Depende de DOM, separado a propósito de `textureBuffer.ts` (que es puro). Sin test unitario dedicado (mockear `Image`/canvas no vale la pena para su tamaño) — cubierto por la revisión visual en vivo.
- **`hooks/useCanvasTexture.ts`** — `useCanvasTexture(buffer, version)`: crea (una sola vez, con inicializador perezoso de `useState`, no refs-durante-render) una `THREE.CanvasTexture` respaldada por un `<canvas>` fuera del DOM, y la resincroniza (`ctx.putImageData` + `texture.needsUpdate = true`) cada vez que `version` cambia. Ver decisión "CanvasTexture vs DataTexture" en `docs/ARQUITECTURA.md`.
- **`components/ColorPicker.tsx`** — paleta de swatches (`<button>` con `aria-label`/`aria-pressed`, `role="group"` en el contenedor) + `<input type="color">` nativo envuelto en `<label>` visible ("Color libre") para el selector libre. Sin librería de color picker custom (HU-5, "no sobre-construyas").
- **`components/TextureEditor.tsx`** — `<canvas>` 2D con backing store de 64×32 (mismas dimensiones que el buffer) escalado por CSS ×10 con `image-rendering: pixelated` (equivalente a `imageSmoothingEnabled = false` para el escalado de presentación, sin librería de zoom). Pointer events (`onPointerDown/Move/Up/Cancel` + `setPointerCapture`) para click-pinta-un-pixel y modo brocha (arrastrar interpola con `TextureBuffer.paintLine` entre la última celda y la actual). `aria-label` describe la cuadrícula.
- **`components/Viewer3D.tsx`** — ahora recibe `texture`/`geometry` como props (ya no hace `useLoader`/`Suspense` sobre un `dataUrl` propio — la textura ya viene creada y sincronizada por `useCanvasTexture` en `Editor.tsx`). `SkeletonModel`/`SkeletonPartMesh` sin cambios de lógica respecto al ticket 001.
- **`components/Editor.tsx`** — compone visor 3D + `TextureEditor` + `ColorPicker` + `HistoryControls` sobre un único `TextureBuffer` (estado subido a este componente, montado solo tras `App.tsx` resolver el fetch — ver ticket 002, "sube el estado a App.tsx o usa un store simple"). Decodifica la textura base (real o placeholder) a `ImageData` al montar y la carga al buffer; expone `setPixel`/`paintLine` a `TextureEditor`, incrementando un contador `version` en cada escritura real (usado tanto para redibujar el canvas del editor como para `texture.needsUpdate`). Desde el ticket 003, también compone un `PaintHistory` (undo/redo — ver abajo) y un listener de teclado global para los atajos estándar.

Construidos en el ticket 003 (deshacer/rehacer — HU-4):

- **`history.ts`** — `PaintHistory`: historial de deshacer/rehacer sobre las escrituras de `TextureBuffer`, en un módulo puro separado (sin React/DOM/three.js), mismo criterio de testabilidad que `textureBuffer.ts`. Unidad de historial: un **trazo completo** (`pointerdown` → `pointerup`/`pointercancel`), no cada pixel individual — ver la justificación completa en `docs/ARQUITECTURA.md`, "Ticket 003". API: `beginStroke()`/`recordChange(x, y, before, after)`/`commitStroke()` (apila el trazo si tuvo cambios y descarta el historial de redo), `undo()`/`redo()` (devuelven el `Stroke` a aplicar o `null`), `canUndo`/`canRedo`. Es la pieza con tests unitarios propios de este ticket (ver `frontend/test/history.spec.ts`).
- **`components/HistoryControls.tsx`** — botones "Deshacer"/"Rehacer" con texto visible (no solo ícono), `disabled` cuando `canUndo`/`canRedo` es `false`. Los atajos de teclado (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y) no viven aquí sino en `Editor.tsx` (listener de `keydown` a nivel de `window`, ver `docs/ARQUITECTURA.md`).
- **`components/TextureEditor.tsx`** — cambio de contrato respecto al ticket 002: agrega props `onStrokeStart`/`onStrokeEnd`, invocadas en `pointerdown` y en `pointerup`/`pointercancel` respectivamente (solo si efectivamente había un trazo en curso), para delimitar la unidad de historial sin acoplar `TextureEditor` a `PaintHistory` directamente — sigue sin saber que existe un historial, solo notifica los límites del trazo.

Construidos en el ticket 004 (simetría de pintura + zoom/grid ajustable — HU-6, HU-7):

- **`symmetry.ts`** — `computeUVBoxRects(geometry)` deriva, a partir de la geometría servida por el backend, el rectángulo UV "cross" completo de cada parte del modelo, deduplicando `armRight`/`armLeft` y `legRight`/`legLeft` (comparten el mismo origen UV) — resultado: 4 cajas distintas para el Esqueleto. `mirrorPointHorizontal(point, boxes)` calcula la contraparte espejada (eje horizontal) de un pixel dentro de la caja UV que lo contiene, o `null` si el punto no cae en ninguna caja conocida o coincide con su propio espejo (columna central de una caja de ancho impar). Módulo puro, sin React/DOM/three.js — testeable con Vitest en `environment: 'node'` (ver `frontend/test/symmetry.spec.ts`). Ver la justificación completa de por qué se ofrece un único eje (horizontal) en `docs/ARQUITECTURA.md`, "Ticket 004".
- **`zoom.ts`** — constantes (`ZOOM_MIN`/`ZOOM_MAX`/`ZOOM_STEP`/`ZOOM_DEFAULT`) y helpers puros (`clampZoom`, `zoomToPercent`) del zoom del editor. Reemplaza el `DISPLAY_SCALE` fijo del ticket 002.
- **`components/SymmetryControls.tsx`** — checkbox "Simetría horizontal" (envuelto en `<label>` con texto visible, sin `aria-label` adicional). Un solo eje, sin selector — ver `docs/ARQUITECTURA.md`.
- **`components/ZoomControls.tsx`** — botones "−"/"+" (icono-solo, con `aria-label`) que ajustan `zoom` en pasos de `ZOOM_STEP`, más el porcentaje actual (100% = 1px CSS por texel).
- **`components/GridToggle.tsx`** — checkbox "Mostrar cuadrícula" (envuelto en `<label>`, default activado).
- **`components/TextureEditor.tsx`** — cambio de contrato respecto al ticket 003: agrega props `zoom`/`onZoomChange` (factor de escala variable, reemplaza `DISPLAY_SCALE`) y `showGrid`. Agrega un segundo `<canvas>` superpuesto (`pointer-events: none`, `aria-hidden`) que dibuja las líneas de cuadrícula a la resolución de presentación (no se puede dibujar en el canvas de textura, que tiene backing store 1:1 con los texeles). Maneja Ctrl/Cmd + rueda del mouse sobre el canvas como mecanismo adicional de zoom (además de los botones de `ZoomControls`).
- **`components/Editor.tsx`** — agrega estado `symmetryEnabled`/`zoom`/`showGrid` y deriva `uvBoxes` de la geometría (`computeUVBoxRects`). Unifica `setPixel`/`paintLine` en un helper interno `applyPixelsWithSymmetry` que, con simetría activa, agrega la contraparte espejada de cada pixel escrito al mismo trazo de `PaintHistory` — un trazo simétrico sigue siendo una única unidad de undo/redo. Ya no llama a `TextureBuffer.paintLine` (ver `docs/ARQUITECTURA.md`, "Ticket 004").

Pendiente de tickets futuros (fuera de alcance del ticket 004, no implementado):

- Importar textura existente + pegar/ajustar imagen a una región UV — ticket 005.
- **`ExportBar`** — botones "Exportar PNG" y "Exportar pack (.zip)" — ticket 006.

## Backend (`backend/src/`)

- **`app.ts`** — crea y configura la app Express (sin auth, sin lógica de negocio): monta `healthRouter` y `baseAssetsRouter`, sirve el build estático del frontend (`FRONTEND_DIST_DIR`, default `./public`) y un catch-all que devuelve `index.html` para rutas no reconocidas.
- **`server.ts`** — entrypoint: llama a `createApp()` y escucha en `PORT` (default `3000`).
- **`routes/health.ts`** — `GET /health`.
- **`routes/baseAssets.ts`** — `GET /api/base-assets/skeleton`: combina `SKELETON_GEOMETRY` (fuente de verdad de geometría/UV) con la textura cargada por `loadSkeletonTexture()`.
- **`geometry/skeletonGeometry.ts`** — definición de las 6 cajas del modelo (tamaño/posición/UV/`mirrorX`), calibrada contra `~/tools/minecraft-texture-pack/mc_render_preview.py` (ver `docs/ARQUITECTURA.md`).
- **`services/skeletonTexture.ts`** — carga `vanilla-assets/skeleton.png` si existe; si no (o falla la lectura por cualquier motivo), cae al placeholder — nunca lanza.
- **`services/placeholderTexture.ts`** — genera el PNG placeholder 64×32 100% procedural (`pngjs`, sin dependencias nativas).
- **`types/baseAssets.ts`** — tipos del contrato de `GET /api/base-assets/skeleton` (ver `docs/API.md`).

## Tests (`backend/test/`)

- **`health.spec.ts`** — `GET /health` responde `200` con `{"status":"ok"}`.
- **`baseAssets.spec.ts`** — `GET /api/base-assets/skeleton` responde `200` con placeholder + geometría cuando el asset real no existe (fuerza `VANILLA_ASSETS_DIR` a un directorio inexistente); nunca responde `5xx` por esta causa.

## Tests (`frontend/test/`) — desde ticket 002 (ampliado en 003 y 004)

- **`textureBuffer.spec.ts`** — cubre `TextureBuffer` (inicialización, `setPixel`/`getPixel` incluyendo fuera de rango, `loadFromImageData`, `paintLine` en varias direcciones/pendientes verificando que no queden huecos, `getRawData` como copia) y `bresenhamLine` en las 4 direcciones diagonales. Vitest con `environment: 'node'` (no requiere jsdom — la lógica es puro `Uint8ClampedArray`, sin DOM). `npm test` / `npm run test:watch` (ver `frontend/vitest.config.ts`).
- **`history.spec.ts`** (ticket 003) — cubre `PaintHistory`: un trazo sin cambios no genera entrada de historial, `commitStroke` habilita `canUndo` y `undo`/`redo` devuelven el trazo esperado, varios trazos se deshacen en orden LIFO, el mismo pixel repintado varias veces dentro de un trazo conserva el `before` original y el `after` final, y pintar un trazo nuevo tras un `undo` descarta el historial de redo (no acumula ramas — criterio explícito del ticket).
- **`symmetry.spec.ts`** (ticket 004) — cubre `computeUVBoxRects` (deriva las 4 cajas UV distintas del Esqueleto a partir de la geometría, sin duplicar `armRight`/`armLeft` ni `legRight`/`legLeft`) y `mirrorPointHorizontal` (espeja un pixel cerca de un borde hacia el borde opuesto de la misma caja, es su propia inversa, devuelve `null` fuera de cualquier caja conocida y en la columna central de una caja de ancho impar).
- No hay tests de componentes de canvas/three.js (`TextureEditor`, `ColorPicker`, `Viewer3D`, `Editor`, `HistoryControls`, `SymmetryControls`, `ZoomControls`, `GridToggle`) — mockear `<canvas>`/pointer events/WebGL para ese nivel de detalle es más ruido que valor dado el alcance de estos tickets; se validan con revisión visual en vivo (ver checklist de cierre). El ticket 004 verificó en vivo (Claude in Chrome): simetría pinta la contraparte espejada dentro de la misma caja UV, un solo "Deshacer" revierte ambos pixeles del trazo simétrico (y "Rehacer" los reaplica), simetría desactivada solo pinta el pixel primario, zoom con botones y con Ctrl/Cmd+rueda funciona y mantiene bordes de pixel nítidos a niveles altos de zoom (3600%–3800%), y el toggle de cuadrícula muestra/oculta las líneas correctamente.

El frontend antes del ticket 002 no tenía runner de tests propio — la validación disponible era `npm run lint` + `npm run build` (sigue siendo parte de la validación, ver `docs/README.md`).
