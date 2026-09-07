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
- **`hooks/useCanvasTexture.ts`** — `useCanvasTexture(buffer, version)`: crea (una sola vez, con inicializador perezoso de `useState`, no refs-durante-render) un `<canvas>` fuera del DOM, y deriva (`useMemo`) la `THREE.CanvasTexture` que lo respalda; la resincroniza (`ctx.putImageData` + `texture.needsUpdate = true`) cada vez que `version` cambia. Ver decisión "CanvasTexture vs DataTexture" en `docs/ARQUITECTURA.md`. **Ticket 014**: cuando `buffer.width`/`buffer.height` cambian de tamaño (cambio de resolución, ticket 009), `useMemo` redimensiona el `<canvas>` y crea una `THREE.CanvasTexture` NUEVA (dispone la vieja) en vez de solo redimensionar y marcar `needsUpdate` — three.js solo reserva memoria de GPU del tamaño correcto en una `Texture` nunca subida, ver `docs/ARQUITECTURA.md`, "Ticket 014", para la causa raíz completa.
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

Construidos en el ticket 005 (importar textura existente + pegar/ajustar imagen a una región UV — HU-8, HU-9):

- **`importImage.ts`** — módulo puro (sin React/DOM/three.js, mismo criterio de testabilidad que `textureBuffer.ts`/`history.ts`/`symmetry.ts`/`zoom.ts`) con toda la lógica de HU-8/HU-9: `validateImportDimensions` (rechaza un PNG que no mida exactamente el tamaño del buffer, HU-8), `computeFullReplaceDiff` (diff pixel a pixel entre el buffer actual y una imagen nueva de las mismas dimensiones, en el mismo shape `PixelChange` que ya usa `PaintHistory` — así el reemplazo completo del buffer se registra como una única unidad de undo reutilizando `beginStroke`/`recordChange`/`commitStroke` tal cual, sin una API de historial nueva), `OverlayRect` (rectángulo del overlay de "pegar imagen", en texeles SIEMPRE enteros), `fitRectToBox` (posición/tamaño inicial del overlay: ajuste por contención centrado dentro de una caja UV), `clampRectToBox`/`findTargetUVBox` (determinan la caja UV objetivo del overlay por mayor área de superposición y recortan a sus límites — el mecanismo central del gotcha "nunca desbordar hacia otra caja UV"), `nearestSourceIndex`/`sampleSourceForDestPixel` (resampling nearest-neighbor, sin interpolación suave), `computeBurnPixels` (orquesta todo lo anterior: devuelve la lista de pixeles a escribir, recortados a la caja UV objetivo, o `null` si el overlay no se superpone con ninguna caja UV conocida). Es la pieza con tests unitarios propios de este ticket (ver `frontend/test/importImage.spec.ts`).
- **`decodeTexture.ts`** — agrega `decodeImageFileToImageData(file)`: decodifica un `File`/`Blob` arbitrario a `ImageData` a su resolución NATURAL (a diferencia de `decodePngDataUrlToImageData`, que fuerza un tamaño fijo porque la textura base ya viene garantizada a 64×32) — necesario para poder rechazar un PNG con dimensiones incorrectas en HU-8 y para aceptar una imagen de cualquier tamaño/proporción en HU-9. Contrato de `previewUrl`: la función crea el `object URL` pero NO lo revoca en el camino exitoso — el llamador decide su ciclo de vida (ver `Editor.tsx`).
- **`components/ImportTextureControl.tsx`** — campo de tipo archivo (`accept="image/png"`, con `<label>` de texto visible + `aria-label`, no una zona de drag&drop — ver decisión en el propio componente) para importar un PNG existente (HU-8); muestra el mensaje de error de dimensiones inline (`role="alert"`, mismo estilo que `initError` de `Editor.tsx`) — nunca un aviso nativo del navegador.
- **`components/PasteImageControls.tsx`** — campo de tipo archivo (`accept="image/*"`, HU-9 admite cualquier imagen) como alternativa explícita al evento `paste` del portapapeles (manejado en `Editor.tsx`, no aquí), más los botones "Confirmar"/"Cancelar" del overlay pendiente y su mensaje de error inline.
- **`components/PasteImageOverlay.tsx`** — overlay arrastrable/redimensionable (HU-9): un `<div>` posicionado sobre `TextureEditor` (como HERMANO, no anidado dentro — para no quedar recortado por el `overflow: hidden` propio de `TextureEditor` al arrastrar/redimensionar más allá de su borde) con una vista previa (`<img>` con `alt` descriptivo, `image-rendering: pixelated`) y una esquina de redimensionado (`<button aria-label="Redimensionar imagen a insertar">`). Convierte los deltas de puntero (pixeles CSS) a texeles dividiendo por `scaleX`/`scaleY` — coordenadas siempre enteras. Recibe `scaleX`/`scaleY` (pixeles CSS RENDERIZADOS por texel, medidos contra el `<canvas>` real, no el valor lógico de `zoom`) en vez de `zoom` directo — ver el hallazgo real documentado en `docs/ARQUITECTURA.md`, "Ticket 005": el canvas de `TextureEditor` puede renderizar texeles no cuadrados (`maxWidth: 100%` dentro de un `<aside>` de ancho fijo), y el overlay necesita alinearse con lo que el canvas REALMENTE muestra, no con lo que `zoom` sugiere en teoría. No conoce cajas UV ni `TextureBuffer`: solo reporta el `OverlayRect` resultante vía `onRectChange`, mismo patrón que `TextureEditor` con `onSetPixel`/`onPaintLine`.
- **`components/Editor.tsx`** — agrega `handleImportFile` (HU-8: decodifica, valida dimensiones, calcula el diff y lo aplica como un único trazo de `PaintHistory`), y el flujo completo de HU-9: `startPendingPaste` (punto de entrada común del listener `paste` a nivel de `window` y del campo de archivo de `PasteImageControls`; solo admite una imagen pendiente a la vez — un segundo intento mientras ya hay una pendiente se rechaza con un mensaje, no la reemplaza en silencio), `handlePendingRectChange`, `handleConfirmPaste` (quema los pixeles que devuelve `computeBurnPixels` como un único trazo) y `handleCancelPaste`. Revoca el `object URL` de la vista previa en un `useEffect` cuya dependencia es específicamente `pendingPaste?.previewUrl` (no el objeto `pendingPaste` completo) — así no se revoca a mitad de un gesto de arrastre/redimensión, que solo cambia `rect`. Mide el `<canvas>` real de `TextureEditor` con `ResizeObserver` (`canvasDisplayScale`) para pasarle a `PasteImageOverlay` la escala RENDERIZADA real en vez de `zoom` — ver hallazgo en `docs/ARQUITECTURA.md`.

Construidos en el ticket 006 (exportar PNG y exportar ZIP del resource pack — HU-10, HU-11):

- **`exportPack.ts`** — módulo puro (sin React/DOM/JSZip, mismo criterio de testabilidad que `textureBuffer.ts`/`history.ts`/`symmetry.ts`/`importImage.ts`) con la lógica de negocio real de HU-11: `buildPackMcmeta(description?)` construye el objeto exacto de `pack.mcmeta` (`pack_format`/`min_format`/`max_format` siempre en `RESOURCE_PACK_FORMAT` = 75 — nunca solo `pack_format`, ver el gotcha documentado abajo) y `buildResourcePackFiles(pngBytes, description?)` arma la lista de archivos del ZIP (rutas + contenido: `pack.mcmeta` serializado y `assets/minecraft/textures/entity/skeleton/skeleton.png` con los bytes PNG recibidos, sin re-leer pixeles por su cuenta — el llamador es quien ya los obtuvo del `TextureBuffer` actual). Es la pieza con tests unitarios propios de este ticket (ver `frontend/test/exportPack.spec.ts`).
- **`export.ts`** — depende de APIs exclusivas del navegador (`<canvas>`, `canvas.toBlob`, `URL.createObjectURL`, `<a download>`) y de `JSZip`, separado a propósito de `exportPack.ts` (igual que `decodeTexture.ts` respecto a `textureBuffer.ts`/`importImage.ts`). `encodeBufferToPngBlob(buffer, uvBoxes)` codifica el contenido ACTUAL del `TextureBuffer` a PNG real (vía un `<canvas>` offscreen + `putImageData` + `toBlob`) — reutilizada tanto por `exportTexturePng` (HU-10: descarga `skeleton.png`) como por `exportResourcePackZip` (HU-11: descarga `resource-pack.zip` con `pack.mcmeta` + el PNG en la ruta vanilla, construido con `JSZip` a partir de `buildResourcePackFiles`). Sin test unitario dedicado (mockear canvas/JSZip/descarga es más ruido que valor) — cubierto por revisión visual en vivo. Ticket 015 (mitigación del bug "hat overlay contaminado"): antes de volcar los pixeles al canvas se pasan por `maskPixelsOutsideUVBoxes` (`uvBoxCleanup.ts`) contra `uvBoxes` — cualquier pixel fuera de las cajas UV conocidas queda en `alpha=0` en el PNG exportado, sin importar qué haya en el buffer real (que nunca se muta). `uvBoxes` debe llegar ya escalado a la resolución de trabajo activa (`computeUVBoxRects(geometry, resolution)`), calculado en `Editor.tsx`.
- **`symmetry.ts`** (ticket 015) — `findContainingBox(point, boxes)` pasa de helper privado a exportado, sin cambios de comportamiento: `uvBoxCleanup.ts` lo reutiliza para no duplicar el chequeo de pertenencia a una caja UV.
- **`uvBoxCleanup.ts`** (ticket 015) — módulo puro (mismo criterio de testabilidad que `symmetry.ts`/`importImage.ts`): `isInsideAnyUVBox(x, y, boxes)` envuelve `findContainingBox` de `symmetry.ts` (ahora exportada) para el chequeo de pertenencia; `maskPixelsOutsideUVBoxes(source, boxes)` devuelve una copia NUEVA de un `PixelSource` con `alpha=0` forzado fuera de `boxes`, sin tocar RGB ni mutar el original. Reutilizado tanto por `export.ts` (limpieza al exportar, obligatoria) como por `components/Editor.tsx#handleImportFile` (limpieza de un PNG importado antes de cargarlo al buffer, ticket 015 Parte B). Tests en `frontend/test/uvBoxCleanup.spec.ts`.
- **`components/ExportControls.tsx`** — botones "Exportar PNG"/"Exportar pack (.zip)" (texto visible, no solo ícono). Lee el `TextureBuffer` compartido en el momento del click, sin copia propia — funciona igual sin importar si el contenido actual vino de pintar a mano, de importar (ticket 005, HU-8) o de pegar una imagen (ticket 005, HU-9). `disabled` mientras la exportación en curso está en vuelo, evitando una segunda descarga por doble click; error inline (`role="alert"`) si la codificación/descarga falla. Recibe también `uvBoxes` (ticket 015) y lo pasa tal cual a `exportTexturePng`/`exportResourcePackZip`, sin recalcularlo.
- **`components/Editor.tsx`** — agrega la sección "Exportar" con `ExportControls`, pasándole el mismo `buffer` compartido y, desde el ticket 015, `uvBoxes` (ya calculado en el componente para simetría/pegado — sin estado nuevo propio, HU-10/HU-11 son operaciones de lectura puntual, no requieren `version` ni re-render). `handleImportFile` (ticket 015 Parte B) aplica `maskPixelsOutsideUVBoxes` a la imagen decodificada antes de diffear/cargarla al buffer.

Construidos en el ticket 009 (corregir geometria + generalizar dimensiones + resolucion de trabajo escalable x1-x10):

- **`resolution.ts`** — modulo puro (mismo criterio de testabilidad que `textureBuffer.ts`/`symmetry.ts`/`importImage.ts`) con `RESOLUTION_MIN`/`RESOLUTION_MAX`/`RESOLUTION_DEFAULT`, `clampResolutionMultiplier` y `resamplePixelSource(source, newWidth, newHeight)` (nearest-neighbor, reutiliza `nearestSourceIndex` de `importImage.ts` en vez de duplicar la tecnica — ver `docs/ARQUITECTURA.md`, "Ticket 009", para el criterio completo de escalar arriba/abajo). Es la pieza con tests unitarios propios de este ticket (ver `frontend/test/resolution.spec.ts`).
- **`symmetry.ts`** — `computeUVBoxRects(geometry, scale = 1)` gana un segundo parametro opcional: multiplica el rectangulo UV completo por `scale` (compatible con el resto de llamadores/tests previos a este ticket, que no lo pasan). `Editor.tsx` lo usa con `scale = resolution` para que simetria/pegado de imagen operen en el mismo espacio de coordenadas que el `TextureBuffer` activo a cualquier resolucion de trabajo.
- **`history.ts`** — agrega `PaintHistory.clear()`: descarta undo, redo y cualquier trazo pendiente sin cerrar — usado al cambiar de resolucion de trabajo (el historial existente queda en coordenadas del tamaño anterior, ver `docs/ARQUITECTURA.md`).
- **`components/ResolutionControls.tsx`** — `<select>` nativo envuelto en `<label>` con texto visible (mismo patron que `ImportTextureControl`), opciones ×1 a ×10 con las dimensiones resultantes entre parentesis.
- **`hooks/useCanvasTexture.ts`** — corrige un bug latente (activado por este ticket, no preexistente en la practica): el `<canvas>` offscreen ahora se redimensiona si `buffer.width`/`buffer.height` ya no coinciden con su tamaño actual, antes de volcar los pixeles — necesario porque `buffer` ahora puede ser reemplazado por una instancia de otro tamaño (cambio de resolucion).
- **`components/Editor.tsx`** — `buffer` pasa de `useState` sin setter a `useState` CON setter (`setBuffer`): cambiar la resolucion de trabajo crea una instancia NUEVA de `TextureBuffer` (sus dimensiones son `readonly`) con el contenido re-muestreado, nunca muta la existente. `handleResolutionChange` orquesta el re-muestreo + `history.clear()` + cancelar cualquier pegado pendiente. El efecto de carga inicial de la textura base ya NO depende de `buffer` (evita re-dispararse en cada cambio de resolucion, y evita un bug real con `<StrictMode>` detectado en la revision visual de este ticket — ver `docs/ARQUITECTURA.md`): usa la forma funcional de `setBuffer` para escribir siempre sobre el buffer vigente.
- **`backend/src/geometry/skeletonGeometry.ts`** — `armRight`/`armLeft`/`legRight`/`legLeft` corregidos de `size [4,12,4]` a `[2,12,2]` (huesos delgados del Esqueleto real, no la proporcion generica de Steve/zombie) — ver `docs/ARQUITECTURA.md` para las dos fuentes de verificacion.

Construidos en el ticket 010 (panel lateral redimensionable con pixeles siempre cuadrados):

- **`canvasSize.ts`** — módulo puro (mismo criterio de testabilidad que `zoom.ts`/`resolution.ts`) con `computeCanvasDisplaySize(nativeWidth, nativeHeight, zoom)` (tamaño de presentación del canvas: SIEMPRE el mismo factor de escala en ambos ejes, garantizando texeles cuadrados por construcción, sin importar el ancho disponible del panel) y `canvasOverflowsAvailableWidth(canvasWidth, availableWidth)` (decide si el contenedor debe scrollear horizontalmente, nunca si el canvas debe comprimirse). Es la pieza con tests unitarios propios de este ticket (ver `frontend/test/canvasSize.spec.ts`).
- **`panelWidth.ts`** — constantes (`PANEL_WIDTH_MIN=220`/`PANEL_WIDTH_MAX=640`/`PANEL_WIDTH_DEFAULT=280`/`PANEL_WIDTH_KEYBOARD_STEP=20`) y `clampPanelWidth` (testeada en `frontend/test/panelWidth.spec.ts`), más `loadStoredPanelWidth`/`savePanelWidth` (lectura/escritura de `localStorage`, dependientes de `window` — no testeadas con Vitest, mismo criterio que `decodeTexture.ts`/`export.ts`; nunca lanzan, con `console.warn` visible ante cualquier fallo).
- **`components/PanelResizeHandle.tsx`** — handle arrastrable (`role="separator"`, `aria-label`/`aria-valuenow`/`aria-valuemin`/`aria-valuemax` — no tiene texto visible) entre el visor 3D y el `<aside>`. Mismo patrón de arrastre que `PasteImageOverlay.tsx` (`setPointerCapture` + delta de `clientX` contra un `ref`). Soporta teclado (flechas izquierda/derecha ±`PANEL_WIDTH_KEYBOARD_STEP`, Home/End a min/max) para accesibilidad. Persiste en `localStorage` solo al terminar el gesto (`pointerup`/`pointercancel`) o tras cada ajuste discreto de teclado, no en cada `pointermove`.
- **`components/TextureEditor.tsx`** — cambio de contrato visual respecto al ticket 004: ya NO usa `maxWidth: '100%'` en ningún estilo del `<canvas>`/`<div>` contenedor — el tamaño de presentación se deriva exclusivamente de `computeCanvasDisplaySize`. Esto elimina la distorsión de texeles documentada en el ticket 005/008 (`docs/ARQUITECTURA.md`).
- **`components/Editor.tsx`** — agrega estado `panelWidth` (leído perezosamente de `localStorage` al montar) y envuelve `TextureEditor`+`PasteImageOverlay` en un `<div style={{ overflowX: 'auto' }}>` nuevo (mide su ancho real con `ResizeObserver`, mismo patrón que la medición de `canvasDisplayScale` ya existente para el overlay de pegar imagen) — si el canvas no cabe, este contenedor scrollea en vez de comprimir el canvas, y se muestra un mensaje informativo. El `<aside>` pasa de `width: 280` fijo a `width: panelWidth` variable.

Construidos en el ticket 018 (selector de mob en el frontend — HU-1/HU-2 de `docs/definiciones/multi-mob-y-proyectos-guardados.md`):

- **`types/mobs.ts`** — espejo del contrato de `GET /api/mobs` (ticket 016): `MobSummary` (`{ id, label }`) y `MobsResponse`. Mismo criterio de duplicación deliberada que `types/baseAssets.ts` (sin paquete compartido).
- **`api/mobs.ts`** — `fetchMobs()`: cliente `fetch` de `GET /api/mobs`. No hardcodea ningún mob — el menú (`MobSelector`) muestra exactamente lo que este catálogo devuelva en cada momento.
- **`api/baseAssets.ts`** — `fetchSkeletonBaseAssets()` (literal a `/api/base-assets/skeleton`) se generaliza a `fetchMobBaseAssets(mobId)`, que pide `/api/base-assets/:mobId` para cualquier mob del catálogo. Mismo contrato HTTP, solo parametrizado.
- **`types/baseAssets.ts`** — renombrado `Skeleton*` → `Mob*` (`MobBoxPart`/`MobGeometry`/`MobTexture`/`MobBaseAssetsResponse`), espejando el mismo rename que el backend ya hizo en el ticket 016 (sin cambio de forma/contrato — puro rename de tipos TypeScript). `regionLabels.ts`, `symmetry.ts` y `components/Viewer3D.tsx` actualizan sus imports de tipo en consecuencia; sin cambio de comportamiento.
- **`components/MobSelector.tsx`** — menú de selección de mob (HU-1): un botón por mob del catálogo (`role="radiogroup"`/`role="radio"`/`aria-checked`/`aria-pressed`, mismo patrón de "grupo de opciones exclusivas" que la paleta de `ColorPicker`), con texto visible (nombre del mob) — no requiere `aria-label` adicional. Genérico: no conoce ningún id de mob en particular, solo renderiza el array que recibe.
- **`components/Viewer3D.tsx`** — gana la prop `mobLabel` (nombre legible del mob activo) para que el `aria-label` del contenedor (`"Vista 3D del modelo del {mobLabel}..."`) describa el mob REALMENTE mostrado — antes de este ticket decía "Esqueleto" hardcodeado, lo cual habría quedado incorrecto para lectores de pantalla en cuanto el visor pudiera mostrar cualquier otro mob (regla de accesibilidad del equipo). Los helpers internos de render se renombran `SkeletonPartMesh`/`SkeletonModel` → `MobPartMesh`/`MobModel` (cosmético, no exportado).
- **`components/Editor.tsx`** — gana las props `mobId`/`mobLabel`/`bufferCache` (HU-2, "el trabajo del primer mob debe seguir ahí"). `bufferCache` es un `Map<string, TextureBuffer>` compartido y estable entre renders de `App.tsx`, que sobrevive a que `Editor` se desmonte/remonte por completo (`App.tsx` usa `key={mobId}` para forzar ese remount al cambiar de mob, reseteando intencionalmente TODO el resto del estado interno — zoom, historial, simetría, parte aislada, panel de importar/pegar — que no tiene sentido preservar entre mobs distintos). Al montar, el `useState` perezoso de `buffer` busca primero en `bufferCache.get(mobId)`: si existe (visita repetida al mismo mob en la sesión), lo reusa tal cual (pixeles + resolución de trabajo con la que se dejó); si no, crea un buffer en blanco como siempre. Un flag `hadCachedBuffer` (leído una sola vez al montar, mismo patrón que `loadStoredPanelWidth`) evita que el efecto de carga inicial sobreescriba ese buffer reusado con la textura base recién fetcheada. Un `useEffect` con deps `[bufferCache, mobId, buffer]` registra (o re-registra) la instancia vigente de `buffer` en la cache — cubre tanto el montaje inicial como cualquier reemplazo posterior de `buffer` por una instancia nueva (cambio de resolución de trabajo, ticket 009). Ver `docs/ARQUITECTURA.md`, "Ticket 018", para el detalle completo de esta decisión y las alternativas descartadas.
- **`App.tsx`** — cambia de "orquesta el fetch de un único asset hardcodeado" a "orquesta el catálogo de mobs + el asset del mob seleccionado": `mobsState` (`GET /api/mobs`) + `assetState` (`GET /api/base-assets/:mobId`, keyed por `selectedMobId`) + `bufferCache` (`useState` con inicializador perezoso — NO `useRef`, para no disparar el warning de oxlint `react(refs)` "no leer `.current` durante el render" al pasarla como prop; mismo criterio ya establecido por `useCanvasTexture.ts`). `selectedMobId` se DERIVA en cada render (`selectedMobIdOverride ?? primerMobDelCatalogo`) en vez de sincronizarse con un efecto dedicado (oxlint `react(set-state-in-effect)`: nunca usar un efecto solo para copiar un valor de otro estado). El header muestra dinámicamente `Texture Studio MC — {mobLabel}` en vez del texto fijo "— Esqueleto" de antes de este ticket.

### Ticket 020 -- Araña (primera anatomía no-biped)

- **`types/baseAssets.ts`** — `MobGeometry.parts` generalizado de las 6 claves fijas del biped a `Record<string, MobBoxPart>`; `MobBoxPart` gana el campo opcional `group` (reemplaza la tabla estática `PART_GROUP_KEY` que antes vivía en `regionLabels.ts`). Ensanchamiento de contrato, no ruptura — ver `docs/ARQUITECTURA.md`, "Ticket 020".
- **`regionLabels.ts`** — `computeNamedRegions` deriva el `groupKey` de cada parte de `part.group ?? partKey` (antes: tabla estática `PART_GROUP_KEY` con las 6 claves fijas del biped, incapaz de cubrir un mob con partes de nombre arbitrario como la Araña).
- **`partIsolation.ts`** — `GROUP_DISPLAY_LABELS` gana `thorax`/`abdomen`/`spiderLeg` → "Tórax"/"Abdomen"/"Pata" (el selector "Aislar parte" ya era genérico, solo necesitaba las etiquetas de los grupos nuevos).
- **`geometry/geometryBounds.ts`** (nuevo) — `computeGeometryCenter(geometry)`, módulo puro con tests (`geometryBounds.spec.ts`) que deriva el centro del bounding box 3D real de cualquier `MobGeometry`. Reemplaza el `target={[0, 16, 0]}` fijo de `OrbitControls` en `Viewer3D.tsx` (correcto solo por coincidencia para el biped clásico) — confirmado que para Esqueleto/Zombie sigue devolviendo exactamente `[0, 16, 0]` (sin regresión), y centra correctamente la cámara en mobs de otro tamaño/proporción (Araña, y cualquier mob futuro).
- **`backend/src/geometry/spiderGeometry.ts`** (nuevo) — geometría completa de la Araña (`head`/`thorax`/`abdomen`/8 patas `leg1Right`..`leg4Left`), investigada contra `bedrock-samples/spider.geo.json` + verificación empírica pixel a pixel contra el asset vanilla real. Las 8 patas comparten `group: 'spiderLeg'` (misma región UV que las 8). Ver `docs/ARQUITECTURA.md`, "Ticket 020", para la investigación completa y el hallazgo de que las patas se ven amontonadas en el visor 3D (fiel a la pose "bind" oficial, no un bug).

### Ticket 021 -- Creeper (segunda anatomía no-biped, y primer asset vanilla no cacheado de antemano)

- **`backend/src/geometry/creeperGeometry.ts`** (nuevo) — geometría completa del Creeper (`head`/`body`/4 patas `legFrontRight`/`legFrontLeft`/`legBackRight`/`legBackLeft`, `group: 'creeperLeg'` compartido), investigada contra `bedrock-samples/creeper.geo.json` + verificación empírica pixel a pixel. `creeper.png` no estaba cacheado (a diferencia de Zombie/Araña) -- se extrajo legítimamente del client `.jar` ya instalado en la Mac antes de poder verificar. A diferencia de la Araña, ninguna pata lleva `mirrorX` (no está en la fuente oficial) y el modelo se ve correctamente reconocible en el visor 3D sin ninguna limitación que documentar (las 4 patas están bien separadas en posición, sin el amontonamiento de las 8 patas de la Araña). Ver `docs/ARQUITECTURA.md`, "Ticket 021".
- **`partIsolation.ts`** — `GROUP_DISPLAY_LABELS` gana `creeperLeg` → "Pata" (clave propia, no reusa `spiderLeg` de la Araña -- son grupos de mobs distintos).

Construidos en el ticket 019 (guardado de proyectos por nombre en `localStorage` — HU-3/HU-4/HU-5 de `docs/definiciones/multi-mob-y-proyectos-guardados.md`):

- **`projectStorage.ts`** — módulo PURO (sin React/DOM/canvas, mismo criterio de testabilidad que `textureBuffer.ts`/`symmetry.ts`/`resolution.ts`): `saveProject(name, mobs, {overwrite})`/`loadProject(name)`/`listProjects()`/`deleteProject(name)`/`projectExists(name)` sobre la clave `localStorage["texture-studio-mc:projects"]`, con el formato exacto documentado en `docs/definiciones/multi-mob-y-proyectos-guardados.md` (`{ [nombre]: { updatedAt, mobs: { [mobId]: { resolution, pngDataUrl } } } }`). Usa `globalThis.localStorage` (no `window.localStorage`) precisamente para poder mockearlo en tests con `environment: 'node'` (ver el comentario del propio archivo). `saveProject` lanza `ProjectAlreadyExistsError` si el nombre ya existe y no se pasa `overwrite: true` — la regla "nunca sobrescribir en silencio" (HU-3) se hace cumplir en el módulo de datos, no solo como convención de la UI. `saveProject`/`deleteProject` nunca atrapan un fallo de `localStorage.setItem` (ej. `QuotaExceededError`) — se propaga tal cual para que la UI pueda avisar al usuario (regla del equipo "nunca fallar en silencio"). Es la pieza con tests unitarios propios de este ticket (ver `frontend/test/projectStorage.spec.ts`, con un `MockStorage` en memoria que implementa la interfaz `Storage`).
- **`projectSnapshot.ts`** — depende de APIs del navegador (`encodeBufferToPngBlob`/`decodePngDataUrlToImageData`/`FileReader`), separado a propósito de `projectStorage.ts` (puro), mismo criterio que `decodeTexture.ts`/`export.ts` frente a `textureBuffer.ts`/`exportPack.ts`. `buildProjectSnapshot(bufferCache, geometryCache)` arma el `mobs` que espera `saveProject`: para cada mob en `bufferCache` (ticket 018), deriva su resolución de trabajo (`buffer.width / geometry.textureWidth`), calcula `uvBoxes` a esa escala y codifica el PNG reutilizando `encodeBufferToPngBlob` TAL CUAL — esto significa que el guardado de proyectos aplica la misma limpieza del ticket 015 (`maskPixelsOutsideUVBoxes`) que ya aplica la exportación: cualquier pixel fuera de las cajas UV conocidas (ej. la zona "hat" del layout clásico) se guarda en `alpha=0`, igual que en un export — ver la justificación completa y su consecuencia (ese contenido no sobrevive un ciclo guardar+cargar) en el comentario del propio archivo y en `docs/ARQUITECTURA.md`, "Ticket 019". `restoreProjectBuffers(mobs)` reconstruye un `TextureBuffer` por mob decodificando cada PNG a su resolución NATURAL (ver extensión de `decodePngDataUrlToImageData` abajo) — no necesita volver a pedirle al backend la geometría de cada mob del proyecto solo para conocer sus dimensiones nativas. Sin tests unitarios dedicados (mockear canvas/`FileReader`/`Image` es más ruido que valor dado su tamaño) — cubierto por la revisión visual en vivo con `getImageData` real.
- **`decodeTexture.ts`** — `decodePngDataUrlToImageData(dataUrl, width?, height?)` gana `width`/`height` OPCIONALES: si se omiten, decodifica a la resolución NATURAL del PNG (`img.naturalWidth/Height`) en vez de forzar un tamaño. El caso existente (llamado con `width`/`height` explícitos desde `Editor.tsx` para la textura base) no cambia de comportamiento. Necesario para `restoreProjectBuffers` sin duplicar la función.
- **`components/ProjectControls.tsx`** — input de nombre + "Guardar", lista de proyectos guardados (nombre + fecha, más reciente primero) con "Cargar"/"Eliminar". Vive en `App.tsx` (no dentro de `Editor.tsx`, que se remonta por completo al cambiar de mob, ticket 018) porque un proyecto agrupa varios mobs a la vez. Confirmaciones de HU-3 (sobrescribir) y HU-5 (eliminar): confirmación **en línea** dentro de la propia página (reemplaza el botón por "¿Seguro? Sí/No"), NO `window.confirm` nativo — decisión tomada tras un hallazgo real durante la revisión en vivo de este ticket (ver "Ticket 019" en `docs/ARQUITECTURA.md`): un diálogo nativo bloquea el hilo de JS de la página hasta resolverse, y la automatización de Claude in Chrome (vía DevTools Protocol) no tiene forma de aceptarlo/cancelarlo — la pestaña queda completamente congelada.
- **`components/Editor.tsx`** — FIX (bug latente del ticket 018, encontrado al implementar este ticket): `resolution` ya no arranca siempre en `RESOLUTION_DEFAULT` — se deriva de `bufferCache.get(mobId)?.width / baseTexture.width` cuando el buffer viene de la cache (mismo patrón de lazy initial state que `hadCachedBuffer`). Sin este fix, un buffer cacheado con una resolución de trabajo distinta de x1 (por una visita anterior al mob, o por un proyecto recién cargado) dejaba `uvBoxes`/`namedRegions` desincronizados del tamaño real del buffer, rompiendo silenciosamente la exportación (ticket 015: `encodeBufferToPngBlob` habría enmascarado como "fuera de cualquier caja UV" la mayor parte de un buffer a resolución alta). Ver el comentario completo en el propio archivo.
- **`App.tsx`** — agrega `geometryCache` (`Map<string, MobGeometry>`, mismo patrón de `useState` perezoso que `bufferCache`) poblado en el efecto de fetch del asset, y `loadGeneration` (contador que fuerza el remount de `Editor` cuando un proyecto cargado incluye al mob actualmente activo — `key={`${selectedMobId}-${loadGeneration}`}`). Renderiza `ProjectControls` en una fila propia debajo del header (visible sin importar el mob activo).



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
- **`baseAssets.spec.ts`** — `GET /api/base-assets/skeleton` responde `200` con placeholder + geometría cuando el asset real no existe (fuerza `VANILLA_ASSETS_DIR` a un directorio inexistente); nunca responde `5xx` por esta causa. Ticket 009: agrega assertions de `size`/`position` de `armRight`/`armLeft`/`legRight`/`legLeft` (huesos delgados `[2,12,2]`, brazos en `x=∓5`) para dejar la corrección de geometría cubierta por test, no solo por revisión visual.

## Tests (`frontend/test/`) — desde ticket 002 (ampliado en 003 y 004)

- **`textureBuffer.spec.ts`** — cubre `TextureBuffer` (inicialización, `setPixel`/`getPixel` incluyendo fuera de rango, `loadFromImageData`, `paintLine` en varias direcciones/pendientes verificando que no queden huecos, `getRawData` como copia) y `bresenhamLine` en las 4 direcciones diagonales. Vitest con `environment: 'node'` (no requiere jsdom — la lógica es puro `Uint8ClampedArray`, sin DOM). `npm test` / `npm run test:watch` (ver `frontend/vitest.config.ts`).
- **`history.spec.ts`** (ticket 003; ampliado en el ticket 009) — cubre `PaintHistory`: un trazo sin cambios no genera entrada de historial, `commitStroke` habilita `canUndo` y `undo`/`redo` devuelven el trazo esperado, varios trazos se deshacen en orden LIFO, el mismo pixel repintado varias veces dentro de un trazo conserva el `before` original y el `after` final, pintar un trazo nuevo tras un `undo` descarta el historial de redo (no acumula ramas — criterio explícito del ticket), y (ticket 009) `clear()` descarta undo, redo y cualquier trazo pendiente sin cerrar — usado al cambiar la resolución de trabajo del editor.
- **`symmetry.spec.ts`** (ticket 004; fixture de geometría actualizada en el ticket 009 con los brazos/piernas delgados corregidos) — cubre `computeUVBoxRects` (deriva las 4 cajas UV distintas del Esqueleto a partir de la geometría, sin duplicar `armRight`/`armLeft` ni `legRight`/`legLeft`; ticket 009 agrega el parámetro `scale`, verificando que multiplica el rectángulo completo y que `scale=1` es idéntico al comportamiento previo sin el parámetro) y `mirrorPointHorizontal` (espeja un pixel cerca de un borde hacia el borde opuesto de la misma caja, es su propia inversa, devuelve `null` fuera de cualquier caja conocida y en la columna central de una caja de ancho impar).
- **`resolution.spec.ts`** (ticket 009) — cubre `clampResolutionMultiplier` (recorta a `[1,10]`, redondea valores no enteros) y `resamplePixelSource`: mismas dimensiones devuelve una copia; escalar hacia arriba (x1→x4) produce bloques N×N idénticos al pixel origen; escalar hacia abajo nunca produce un color mezclado/promediado (siempre uno de los colores reales del bloque origen); un roundtrip x1→x4→x1 sobre contenido de bloques sólidos reproduce el contenido original exactamente.
- **`exportPack.spec.ts`** (ticket 006) — cubre `buildPackMcmeta` (los 3 campos `pack_format`/`min_format`/`max_format` siempre en 75 — nunca solo `pack_format`, descripción por defecto y descripción custom, shape exacto sin campos extra, `supported_formats` nunca incluido) y `buildResourcePackFiles` (exactamente 2 archivos con las rutas correctas, `pack.mcmeta` serializa un JSON parseable con el objeto exacto de `buildPackMcmeta`, y los bytes del PNG se pasan sin copiar/alterar — misma referencia recibida, verificando que no se duplica la fuente de verdad).
- **`importImage.spec.ts`** (ticket 005) — cubre `validateImportDimensions` (acepta dimensiones exactas, mensaje de error claro si no coinciden), `computeFullReplaceDiff` (solo reporta los pixeles que realmente cambian, con `before`/`after` correctos y coordenadas `x,y` correctas en una fuente multi-fila), `fitRectToBox` (ajuste por contención centrado dentro de una caja UV, en ambos sentidos de proporción, nunca produce un rectángulo menor a 1×1), `clampRectToBox` (intersección parcial, contención completa, sin superposición, y el caso borde "toca el límite sin área real"), `findTargetUVBox` (elige la caja de mayor área de superposición, `null` si el overlay cae enteramente en una zona de relleno sin caja UV conocida), `nearestSourceIndex`/`sampleSourceForDestPixel` (resampling nearest-neighbor verificado explícitamente: nunca un color mezclado entre dos texeles fuente, tanto agrandando como achicando), y `computeBurnPixels` (quema exactamente los pixeles del overlay cuando cae dentro de una caja, recorta a los límites de la caja UV objetivo cuando el overlay se posiciona más allá de su borde, y — el gotcha central del ticket — nunca reparte pixeles quemados entre dos cajas UV vecinas distintas aunque el overlay se superponga con ambas).
- **`canvasSize.spec.ts`** (ticket 010) — cubre `computeCanvasDisplaySize` (mismo factor de escala en ambos ejes, independiente del ancho de cualquier contenedor) y `canvasOverflowsAvailableWidth` (verdadero solo cuando el ancho del canvas excede el disponible, falso mientras no se haya medido `availableWidth === null`).
- **`panelWidth.spec.ts`** (ticket 010) — cubre `clampPanelWidth` (recorta al rango `[PANEL_WIDTH_MIN, PANEL_WIDTH_MAX]`, deja pasar valores dentro de rango tal cual).
- **`projectStorage.spec.ts`** (ticket 019) — cubre `saveProject`/`loadProject`/`listProjects`/`deleteProject`/`projectExists` con un `MockStorage` en memoria (`beforeEach` lo asigna a `globalThis.localStorage`): guardar y recuperar un proyecto de uno o varios mobs con exactamente los mismos datos, nombre vacío/sin mobs rechazado, `ProjectAlreadyExistsError` al guardar sobre un nombre existente sin `overwrite`, sobrescritura correcta con `overwrite: true`, listado ordenado por `updatedAt` descendente, eliminar un proyecto (no-op seguro sobre un nombre inexistente, no afecta a otros proyectos), un fallo de `setItem` (ej. `QuotaExceededError` simulado con `vi.spyOn`) se propaga sin atraparse, y lectura defensiva ante un valor corrupto en `localStorage` (JSON inválido o JSON válido pero no es un objeto de proyectos).
- No hay tests de componentes de canvas/three.js (`TextureEditor`, `ColorPicker`, `Viewer3D`, `Editor`, `HistoryControls`, `SymmetryControls`, `ZoomControls`, `GridToggle`, `ImportTextureControl`, `PasteImageControls`, `PasteImageOverlay`, `ExportControls`, `MobSelector`, `App`) ni del módulo `export.ts` (codificación PNG real + `JSZip` + descarga) — mockear `<canvas>`/pointer events/WebGL/`File`/portapapeles/`JSZip`/descarga para ese nivel de detalle es más ruido que valor dado el alcance de estos tickets; se validan con revisión visual en vivo (ver checklist de cierre). El ticket 004 verificó en vivo (Claude in Chrome): simetría pinta la contraparte espejada dentro de la misma caja UV, un solo "Deshacer" revierte ambos pixeles del trazo simétrico (y "Rehacer" los reaplica), simetría desactivada solo pinta el pixel primario, zoom con botones y con Ctrl/Cmd+rueda funciona y mantiene bordes de pixel nítidos a niveles altos de zoom (3600%–3800%), y el toggle de cuadrícula muestra/oculta las líneas correctamente. El ticket 005 verificó en vivo (ver `docs/ARQUITECTURA.md`, "Ticket 005"). El ticket 006 verificó en vivo (ver `docs/ARQUITECTURA.md`, "Ticket 006"). El ticket 018 verificó en vivo (ver `docs/ARQUITECTURA.md`, "Ticket 018") el aislamiento real del buffer por mob con `getImageData`, no solo inspección visual. El ticket 019 verificó en vivo (ver `docs/ARQUITECTURA.md`, "Ticket 019") el ciclo completo guardar→recargar la página completa→cargar, con `getImageData` confirmando pixel a pixel la recuperación exacta en ambos mobs de un proyecto multi-mob, además de la confirmación de sobrescritura y de eliminación.

El frontend antes del ticket 002 no tenía runner de tests propio — la validación disponible era `npm run lint` + `npm run build` (sigue siendo parte de la validación, ver `docs/README.md`).

### Ticket 025 -- Sistema de componentes base (`frontend/src/ui/`)

- **`ui/Button.tsx`/`ui/FormField.tsx`/`ui/Select.tsx`/`ui/Section.tsx`/`ui/Menu.tsx`/`ui/LoadingOverlay.tsx`** (nuevos) — primitivas del panel, ver `docs/ARQUITECTURA.md`, "Ticket 025", para el detalle completo de cada una y los tokens de diseño que consumen.
- **`ui/menuNavigation.ts`** (nuevo, puro) — `getNextMenuItemIndex(currentIndex, key, itemCount)`, navegación por teclado del `Menu` (flechas/Home/End con wrap), testeado en `menuNavigation.spec.ts`.
- **`components/HistoryControls.tsx`**/**`components/ResolutionControls.tsx`** — migrados a `Button`/`FormField`+`Select` (primer consumidor real de `ui/`, resto de controles pendiente para el ticket 026).

### Ticket 026 -- Refactor de los controles existentes al sistema de componentes

- **`ui/Checkbox.tsx`**/**`ui/InlineError.tsx`** (nuevos, encontrados durante el refactor) — patrones duplicados literalmente entre `SymmetryControls`/`GridToggle` y entre `ImportTextureControl`/`PasteImageControls`/`ExportControls`/`ProjectControls` respectivamente. `Button` gana la variante `danger`.
- **`SymmetryControls.tsx`/`GridToggle.tsx`** — migrados a `Checkbox`.
- **`ZoomControls.tsx`** — botones `-`/`+` migrados a `Button variant="icon"`.
- **`PartIsolationControls.tsx`** — migrado a `FormField`+`Select`+`Button` (layout de fila a columna, ver `docs/ARQUITECTURA.md`, "Ticket 026").
- **`ImportTextureControl.tsx`/`PasteImageControls.tsx`/`ExportControls.tsx`** — migrados a `FormField`+`Button`+`InlineError`.
- **`ProjectControls.tsx`** — migrado a `FormField`+`Button` (`variant="danger"` en "Sí, sobrescribir"/"Sí, eliminar")+`InlineError`; se eliminan `buttonStyle`/`dangerButtonStyle`/`inputStyle` ad-hoc.
- **`MobSelector.tsx`** — migrado a `Button` (`variant="primary"` para el mob activo, `"secondary"` para el resto).
- **`ColorPicker.tsx`** — los swatches de la paleta se dejan como `<button>` nativo (necesitan color de fondo dinámico por instancia, no cubierto por las variantes de `Button`); el selector "Color libre" migra a `FormField` (nueva variante `.ui-field--inline` para su layout en fila).

### Ticket 027 -- Pantalla de inicio + navegación Home/Editor

- **`App.tsx`** — gana `view: 'home' | 'editor'` (sin router). `handleSelectMob` es el único punto de entrada para "activar mob + ver editor" (usado por `MobSelector` y `HomeScreen`); `handleProjectOpenedFromHome` (nuevo) navega a editor tras cargar un proyecto desde el inicio. Botón "← Volver al inicio" en el header de la vista de editor. Los bloques `mobsState.status === 'loading'/'error'` de la vista de editor se eliminaron por ser código inalcanzable tras el split de vistas.
- **`components/HomeScreen.tsx`** (nuevo) — dos `Section`: "Selección de mob" (un `Button` por mob) y "Guardados" (lista clicable, reusa `loadProject`/`restoreProjectBuffers` del ticket 019 -- misma lógica que `ProjectControls.handleLoad`).
- **`projectStorage.ts`** — `ProjectSummary` gana `mobIds: string[]` (`Object.keys(record.mobs)`, sin decodificar ningún PNG) -- usado por `HomeScreen` y, en el ticket 028, por el filtro por mob.

### Ticket 028 -- Búsqueda/filtro/orden en "Guardados"

- **`projectFilter.ts`** (nuevo, puro) — `filterAndSortProjects(projects, options)` (busca por nombre + filtra por mob + ordena, 100% client-side) y `collectMobIdsInProjects(projects)` (catálogo de mobs presentes en al menos un proyecto guardado, para poblar el `<select>` de filtro). Ver `projectFilter.spec.ts`.
- **`components/HomeScreen.tsx`** — gana los controles "Buscar"/"Mob"/"Orden" sobre la lista de "Guardados"; el `<select>` de mob solo se muestra si hay más de un mob distinto entre los proyectos guardados.

### Ticket 029 -- Reorganización del panel en grid + visor acotado a 400px

- **`components/Editor.tsx`** — el visor 3D pasa a `flexBasis: 400, flexGrow: 0` (nunca crece más de 400px). El panel de controles se reorganiza en un grid `auto-fit` de `Section` (`ui/`, ticket 025) en vez de `<section><h2>` ad-hoc; la sección "Textura" ocupa todas las columnas (`gridColumn: '1 / -1'`).
- **`ui/Section.tsx`** — gana un prop `style` opcional (necesario para el `gridColumn: '1 / -1'` de la sección "Textura").
- **Eliminados** (ticket 010, panel lateral redimensionable a mano, superado por el layout en grid -- ver `docs/ARQUITECTURA.md`, "Ticket 029"): `components/PanelResizeHandle.tsx`, `panelWidth.ts`, `test/panelWidth.spec.ts`.

### Ticket 030 -- Herramienta de borrado con pincel de tamaño ajustable

- **`brush.ts`** (nuevo, puro) — `computeBrushFootprint(center, size)`/`computeBrushFootprintForLine(linePoints, size)`: expanden un punto (o una línea de puntos) a un bloque `size×size` centrado, para `size` de 1 a 5. Ver `brush.spec.ts`.
- **`components/EraseControls.tsx`** (nuevo) — botón "Borrar"/"Borrar (activo)" (`Button`, `aria-pressed`) + `Select` de tamaño de pincel (solo visible con el modo activo).
- **`components/TextureEditor.tsx`** — gana un prop opcional `forcedRgba?: RGBA` que, si está presente, reemplaza el color de paleta en los 3 puntos de pintado internos (el componente no sabe que existe un "modo borrado").
- **`components/Editor.tsx`** — gana `paintMode: 'paint' | 'erase'` y `eraseBrushSize` (estado independiente de `color`); `setPixel`/`paintLine` expanden a footprint de pincel en modo `erase` antes de pasar por `applyPixelsWithSymmetry` (sin lógica paralela: misma función que ya respeta simetría y aislar-parte). Nueva `Section title="Borrar"` en el grid del panel, justo después de "Color".

### Ticket 031 -- Menú unificado de Archivo (primer consumidor real de `Menu`)

- **`ui/Menu.tsx`** — gana `children?: ReactNode` (contenido libre, para acciones con UI rica que no encajan como `items` planos de ARIA "menu") e `items` pasa a ser opcional. Anclaje del panel (`left`/`right`) ahora se decide en runtime (`toggleOpen`, mide `getBoundingClientRect()` antes de abrir) en vez de fijo por CSS -- ver `docs/ARQUITECTURA.md`, "Ticket 031", para el bug real que esto corrige.
- **`components/Editor.tsx`** — las secciones "Importar / pegar imagen" y "Exportar" se reemplazan por una única `Section title="Archivo"` con un `Menu` cuyo `children` renderiza `ImportTextureControl`/`PasteImageControls`/`ExportControls` tal cual (sin cambios de lógica).
- **`App.tsx`** — la fila donde vivía `ProjectControls` siempre expandida ahora envuelve ese mismo componente (sin cambios de lógica) en un `Menu` label="Proyecto".

### Ticket 032 -- Iconografía y transiciones

- **`components/HistoryControls.tsx`** — íconos ↶/↷ junto a "Deshacer"/"Rehacer".
- **`components/EraseControls.tsx`** — ícono 🗑 junto al texto del botón; el selector de tamaño de pincel gana `.ts-fade-in`.
- **`components/ProjectControls.tsx`** — ícono 💾 junto al botón "Guardar".
- **`components/Editor.tsx`**/**`App.tsx`** — íconos 📁/💾 en los `label` de los menús "Archivo"/"Proyecto"; contenedor raíz de `Editor` gana `.ts-fade-in` (fundido al cambiar de mob).
- **`components/TextureEditor.tsx`** — el canvas de "aislar parte" gana `.ts-fade-in` (fundido al activarse).
- **`App.tsx`** — "Volver al inicio" gana texto visible junto al ícono (antes ícono-solo); pierde `aria-label` (redundante, el texto real es ahora el nombre accesible).

### Ticket 033 -- Estados de carga (primer consumidor real de `LoadingOverlay`)

- **`App.tsx`** — reemplaza los textos planos de "Cargando catálogo de mobs…"/"Cargando modelo…" por `<LoadingOverlay message="..." />` (ticket 025); ambos contenedores padre ganan `position: relative` (`LoadingOverlay` usa `inset: 0`). Cubre carga inicial, reintento tras error y cambio de mob -- sin lógica nueva, solo qué se renderiza para los estados `loading` ya existentes.
- La carga de un proyecto guardado (`ProjectControls.tsx`/`HomeScreen.tsx`) conserva su indicador por-botón existente ("Cargando…"/"Abriendo…", tickets 019/027) -- decisión real de NO migrarlo a `LoadingOverlay`, ver `docs/ARQUITECTURA.md`, "Ticket 033".

### Ticket 034 -- Sistema de tema claro/oscuro

- **`theme.ts`** (nuevo) — `getTheme`/`setTheme`/`toggleTheme`/`nextTheme`, persistencia en `localStorage` (`globalThis.localStorage`). Fuente de verdad única para el toggle rápido y, más adelante, el selector de "Configuración" (ticket 036).
- **`components/ThemeToggle.tsx`** (nuevo) — botón ícono+texto en el header de `App.tsx` (ambas vistas).
- **`index.css`** — tokens de color separados en `:root[data-theme='dark']`/`:root[data-theme='light']`; nuevos tokens `--hover-overlay`/`--overlay-bg`; `color-scheme` fijado por tema (ver `docs/ARQUITECTURA.md`, bug real corregido).
- **`index.html`** — script inline que aplica el tema guardado antes del primer render (sin parpadeo).

### Ticket 035 -- Acento verde

- **`index.css`** — `--accent` pasa de `#c084fc` a `#4ade80` en ambos bloques de tema. Sin cambios de componentes (todo lo que usa `--accent` ya era token-based).

### Ticket 036 -- Preferencias locales de usuario + pantalla Configuración

- **`userPrefs.ts`** (nuevo) — `getUserPrefs`/`setUserPrefs`/`getAvatarInitial`, persistencia en `localStorage`.
- **`projectStorage.ts`** — gana `deleteAllProjects()` (borra solo la clave de proyectos, sin tocar tema/preferencias).
- **`components/Avatar.tsx`** (nuevo) — círculo con la inicial derivada de `displayName`, recibido por props (estado levantado en `App.tsx`).
- **`components/Settings.tsx`** (nuevo) — overlay con 3 secciones: nombre, tema (controlado, misma fuente que `ThemeToggle`), borrar todos los datos locales (confirmación inline).
- **`components/ThemeToggle.tsx`** — pasa de estado propio a CONTROLADO (`theme`/`onThemeChange` por props) -- ver `docs/ARQUITECTURA.md`, bug real corregido.
- **`App.tsx`** — nuevo estado levantado `displayName`/`theme` (fuente única para `Avatar`/`Settings`/`ThemeToggle`); `showSettings` (ubicación temporal del overlay, hasta el ticket 037).

### Ticket 037 -- Shell de navegación nueva (sidebar + header)

- **`components/AppShell.tsx`** (nuevo) — sidebar + header, envuelve todas las vistas excepto el editor.
- **`components/Sidebar.tsx`** (nuevo) — 3 destinos (`NavView`), item activo resaltado, tarjeta de marca al pie.
- **`components/PlaceholderScreen.tsx`** (nuevo) — contenido mínimo para destinos sin implementación real todavía.
- **`components/Settings.tsx`** — deja de ser overlay (`position: fixed`), ahora se renderiza como vista normal dentro de `AppShell`; pierde el prop `onClose` (ya no hace falta).
- **`App.tsx`** — `View` pasa de `'home' | 'editor'` a 7 destinos; `showSettings` se elimina (`handleOpenSettings` navega directo a `'configuracion'`); "Nuevo proyecto"/"Mis proyectos" muestran temporalmente el mismo `HomeScreen` (decisión real documentada, ver `docs/ARQUITECTURA.md`).

### Ticket 038 -- Pantalla "Nuevo proyecto"

- **`components/NuevoProyecto.tsx`** (nuevo) — nombre + selección de UN mob + vista previa 3D en vivo (`Viewer3D`/`useCanvasTexture`, mismo pipeline que `Editor.tsx`); crea el proyecto con `saveProject` (sin cambio de forma) usando `Map` locales de un solo mob, no el `bufferCache`/`geometryCache` compartido.
- **`App.tsx`** — "Nuevo proyecto" ya no muestra el `HomeScreen` temporal (reemplazado por `NuevoProyecto`); "Mis proyectos" lo sigue mostrando (hasta el ticket 039). Nuevo estado `activeProject` (adelanto mínimo del ticket 041) y handler `handleProjectCreated`.

### Ticket 039 -- Pantalla "Mis proyectos"

- **`components/MisProyectos.tsx`** (nuevo) — traslado de la sección "Guardados" de `HomeScreen.tsx` (buscar/filtrar/ordenar, sin cambios de lógica); elegir un proyecto navega a su vista de detalle en vez de al editor.
- **`components/HomeScreen.tsx`** — **eliminado** (`git rm`) -- sin consumidores tras este ticket (038 ya había reemplazado "Nuevo proyecto").
- **`App.tsx`** — "Mis proyectos" usa `MisProyectos`; `handleProjectOpenedFromHome` se elimina, reemplazado por `handleProjectActivated` (compartido con `handleProjectCreated` del ticket 038).

### Ticket 040 -- Pantalla "Recientes"

- **`components/Recientes.tsx`** (nuevo) — top 5 proyectos por `updatedAt` (`filterAndSortProjects` sin búsqueda/filtro, solo orden), sin controles propios; abrir un proyecto usa la misma lógica de restaurar buffers que `MisProyectos.tsx` y navega a `'proyecto'` vía `onProjectSelected`.
- **`App.tsx`** — "Recientes" usa `Recientes` (reemplaza el `PlaceholderScreen` del ticket 037).

### Ticket 041 -- Vista de detalle de "Proyecto"

- **`components/Proyecto.tsx`** (nuevo) — lista de mobs con miniatura real (`<img src={pngDataUrl}>`), elegir uno navega al editor; acciones "Agregar mobs" (navega a `'agregar-mobs'`), "Exportar proyecto (.zip)" (wireado en el ticket 044, `exportProjectZip`), "Renombrar" (`renameProject`, nuevo) y "Eliminar proyecto" (`deleteProject`, con confirmación inline).
- **`projectStorage.ts`** — gana `renameProject(oldName, newName)`: mueve la entrada de clave, sin tocar `mobs`/`updatedAt`; lanza `ProjectAlreadyExistsError` si el nombre destino ya existe (sin ofrecer sobrescribir -- decisión real documentada en `docs/ARQUITECTURA.md`).
- **`App.tsx`** — "Proyecto" usa `Proyecto` (reemplaza el `PlaceholderScreen` del ticket 037); nuevos handlers `handleAddMobs`/`handleProjectRenamed`/`handleProjectDeleted`.

### Ticket 042 -- Flujo "Agregar mobs" (selección múltiple)

- **`components/AgregarMobs.tsx`** (nuevo) — mismo layout de `NuevoProyecto.tsx` (038) con selección MÚLTIPLE (`Set<string>`, toggle por tarjeta); excluye del grid los mobs que el proyecto ya tiene; agrega los seleccionados mezclando con el registro existente vía `saveProject(..., {overwrite: true})`.
- **`components/PlaceholderScreen.tsx`** — **eliminado** (`git rm`) -- sin consumidores tras este ticket (040/041 ya habían reemplazado "Recientes"/"Proyecto").
- **`App.tsx`** — "Agregar mobs" usa `AgregarMobs`; nuevos handlers `handleMobsAdded`/`handleCancelAddMobs`.

### Ticket 043 -- Selector de mob del editor restringido al proyecto activo

- **`components/MobSelector.tsx`** — gana prop opcional `onAddMob` (botón "+ Agregar mob" al final, solo si se pasa); sigue sin saber nada de "proyecto" (genérico).
- **`App.tsx`** — nuevo `editorMobs` (filtra `mobsState.mobs` contra `activeProject.mobIds` antes de pasarlo a `MobSelector`); `onAddMob={handleAddMobs}` reusa el mismo handler del ticket 041.

### Ticket 044 -- Exportar proyecto completo como .zip

- **`exportPack.ts`** — `SKELETON_PNG_PATH` reemplazado por `entityTexturePngPath(mobId)` (ruta vanilla parametrizada por mob); `buildResourcePackFiles` generalizado a `ResourcePackMobInput[]` (N mobs, antes un solo `pngBytes` hardcodeado a Esqueleto); nuevas `dataUrlToBytes` (decodifica un `pngDataUrl` guardado a bytes crudos de PNG, sin canvas) y `projectZipFilename` (slug del nombre del proyecto).
- **`export.ts`** — `exportResourcePackZip` (un solo mob) **eliminada**; nueva `exportProjectZip(projectName, mobs)` itera todos los mobs del proyecto y arma el ZIP reusando cada `pngDataUrl` ya guardado.
- **`components/ExportControls.tsx`** — pierde el botón "Exportar pack (.zip)" (retirado); solo queda "Exportar PNG" (HU-10, sin cambios).
- **`components/Proyecto.tsx`** — "Exportar proyecto (.zip)" deja de estar `disabled`, llama a `exportProjectZip`.

### Ticket 045 -- Retiro del flujo de edición libre sin proyecto (cierre del epic 034-045)

- **`components/ProjectControls.tsx`** — **eliminado** (`git rm`) — menú "💾 Proyecto" del editor (guardar/cargar/eliminar un proyecto directo, independiente de `activeProject`); reemplazado por completo por el flujo `NuevoProyecto`/`MisProyectos`/`Recientes`/`Proyecto`/`AgregarMobs` (038-042).
- **`App.tsx`** — retira el import/render de `ProjectControls` y el `<Menu>` que lo alojaba; retira el estado `geometryCache` (compartido de sesión, sin consumidores tras la migración de 038/042 a Maps locales) y `loadGeneration`/`handleProjectLoaded` (solo existían para el remount que forzaba `ProjectControls`); `key` de `<Editor>` vuelve a ser `selectedMobId` a secas.

### Ticket 046 -- Rediseño visual: topbar, sidebar y "Nuevo proyecto"

- **`ui/icons.tsx`** (nuevo) — set de íconos SVG dibujados a mano (`IconPlus`/`IconFolder`/`IconClock`/`IconSun`/`IconMoon`/`IconSettings`/`IconCube`/`IconEye`/`IconCheck`/`IconInfo`/`IconX`/`IconGrassBlockLogo`), sin librería externa.
- **`assets/mob-icons/{creeper,skeleton,zombie,spider}.png`** (nuevo) — renders oficiales de Minecraft Wiki, importados como assets estáticos de Vite.
- **`mobIcons.ts`** (nuevo) — `MOB_ICONS`/`MOB_DESCRIPTIONS` (`Record<string, string>`), contenido presentacional del frontend.
- **`ui/Button.tsx`** — nuevo `variant="icon-square"` (caja 40x40, solo ícono, texto accesible vía `.sr-only`).
- **`index.css`** — tema oscuro más oscuro, `--accent` afinado a `#34d399`, nuevos `--accent-soft`/`--accent-soft-strong`/`--radius-lg`/`--font-lg`/`--font-xl`, clases `.ui-button--icon-square`/`.sr-only`.
- **`components/Sidebar.tsx`** — rediseño completo: bloque de marca (ícono + título + subtítulo), nav con ícono en caja + estado activo (relleno/borde de acento), tarjeta de marca al pie con fondo decorativo.
- **`components/AppShell.tsx`** — topbar con 3 controles cuadrados; nuevo botón "Configuración" propio (antes solo alcanzable haciendo click en el avatar).
- **`components/Avatar.tsx`** — 40px (antes 28px), ya no envuelto en un botón que abría Configuración.
- **`components/ThemeToggle.tsx`** — `variant="icon-square"` + `IconSun`/`IconMoon` (antes emoji + texto visible).
- **`components/NuevoProyecto.tsx`** — tarjetas de mob con miniatura oficial real + badge de check, encabezados de sección con ícono, badge "Minecraft Java Edition", tarjeta informativa del mob elegido, callout con ícono, campo de nombre con botón "limpiar".

### Ticket 047 -- Correcciones de fidelidad visual (segunda pasada)

- **`assets/brand/{sidebar-bg,logo}.png`** (nuevos) — assets reales de Marco, reemplazan el gradiente CSS y el `IconGrassBlockLogo` hechos a mano.
- **`ui/icons.tsx`** — `IconGrassBlockLogo` eliminado; `IconPlus`/`IconSun`/`IconSettings`/`IconCube` pasan de trazo fino a forma rellena (mezcla real de estilos confirmada en la referencia).
- **`index.css`** — `--bg`/`--panel-bg` re-muestreados (`#0f171d`, iguales entre sí), `--accent` afinado a `#60ef9b`, nuevo `--chip-bg`, `.ui-button--primary` con texto fijo (no ligado al tema).
- **`components/Sidebar.tsx`** — fondo/logo reales; texto FIJO (`SIDEBAR_TEXT`/`SIDEBAR_TEXT_DIM`, no ligado al tema — bug real de contraste en tema claro, corregido); ítems inactivos sin caja alrededor del ícono.
- **`components/Avatar.tsx`** — degradado (antes verde plano), muestreado de la referencia.
- **`components/NuevoProyecto.tsx`** — sin `maxWidth`; "Crear proyecto" movido a una segunda fila del grid (bajo "Vista previa"); ícono del botón en círculo; encabezados sin caja; badge "Minecraft Java Edition" como chip sólido; input restyleado; tarjetas de mob más grandes; fondo cuadriculado en el visor.

### Ticket 048 -- Topbar compartida, cuadrícula 3D real e ícono de info corregido

- **`components/AppShell.tsx`** — reestructurado: nueva topbar compartida (logo + tema/Configuración/avatar) cruzando todo el ancho, arriba de `Sidebar` + contenido (antes el logo vivía en `Sidebar` y los íconos en un header aparte que no cruzaba el ancho completo).
- **`components/Sidebar.tsx`** — pierde el bloque de marca superior (mudado a `AppShell.tsx`); `height: '100%'` (antes `'100vh'`); conserva la tarjeta de marca del pie.
- **`components/Viewer3D.tsx`** — nuevo `<Grid>` (`@react-three/drei`) como piso cuadriculado real dentro de la escena 3D — reemplaza el truco de CSS del ticket 046 (quedaba tapado por el fondo opaco de la escena). Componente compartido — beneficia también a `Editor.tsx`/`AgregarMobs.tsx`.
- **`components/NuevoProyecto.tsx`** — `VIEWER_GRID_STYLE` renombrado a `VIEWER_FRAME_STYLE` (ya sin el truco de CSS, la cuadrícula ahora vive en `Viewer3D.tsx`); `IconInfo` usado a tamaño 28 (antes 16).
- **`ui/icons.tsx`** — `IconInfo` rediseñado como badge relleno (círculo gris + "i" oscura), colores fijos, tamaño default 28 (antes trazo fino, 20).

### Ticket 049 -- Fondo verde + cuadrícula extendida del visor 3D, ícono de Configuración corregido

- **`components/Viewer3D.tsx`** — fondo de la escena a verde oscuro (`#122015`, antes gris); `<Grid>` con `args` mucho más grande (`[300,300]`, antes `[10,10]` — el plano físico era demasiado chico para la escala real de la escena) y `fadeDistance` mayor (220, antes 110); colores de la cuadrícula ajustados a verde.
- **`ui/icons.tsx`** — `IconSettings` reconstruido con geometría radial exacta (círculo + 8 dientes rotados 45° c/u, agujero vía `<mask>` con `useId()`) en vez del `<path>` a mano de la revisión anterior (causa real del ícono "apachurrado").

### Ticket 050 -- Visor 3D como caja cuadriculada + ícono de Configuración correcto

- **`ui/icons.tsx`** — `IconSettings` reconstruido (tercera vez) con la geometría correcta verificada contra referencia real: contorno de 6 pétalos vía curva paramétrica `r(θ)=R_prom+R_amp·cos(6θ)`, trazo fino (no relleno), aro central suelto.
- **`components/Viewer3D.tsx`** — 2 `<Grid>` adicionales rotados 90° simulando paredes izquierda/derecha (mismos colores que el piso, extraídos a `BOX_GRID_PROPS`); `side: THREE.DoubleSide` (drei usa `BackSide` por defecto, culleaba las paredes); colores del piso/paredes más sutiles (`#274435`/`#3c6b4f`, antes `#3a6b4d`/`#5b9e77`).

### Ticket 051 -- Visor 3D: solo piso, colores homologados, material sin tone mapping

- **`components/Viewer3D.tsx`** — se retiran las 2 paredes del ticket 050 (`BOX_GRID_PROPS` renombrado a `FLOOR_GRID_PROPS`, sin `side: THREE.DoubleSide`); colores re-muestreados de la referencia (`#20392c`/`#2c4d3c`, antes `#274435`/`#3c6b4f`); `MeshBasicMaterial` del modelo gana `toneMapped: false` (el `<Canvas>` de r3f aplica `ACESFilmicToneMapping` por defecto, alterando los colores reales de la textura -- causa real de "se ve brilloso").

### Ticket 052 -- Color space de la textura 3D + fondo neutro del visor

- **`hooks/useCanvasTexture.ts`** — `colorSpace = THREE.SRGBColorSpace` explícito en la `CanvasTexture` (defaultea a `NoColorSpace` en three.js, causando un descalce sRGB de un solo sentido -- causa real del modelo "lavado", distinta del tone mapping ya corregido en el ticket 051). Componente compartido, aplica a toda la app.
- **`components/Viewer3D.tsx`** — fondo revertido a `#0f171d` (el mismo `--bg` del resto de la app, antes `#122015` verde del ticket 049) -- muestreo de la nueva imagen de referencia confirmó que no es verde.

### Ticket 053 -- Rediseño de "Mis proyectos" + acciones reales por tarjeta

- **`components/ProjectCard.tsx`** (nuevo) — tarjeta de un proyecto guardado, layout `grid`/`list`; autocontenida para Renombrar/Duplicar/Exportar/Eliminar (llama directo a `projectStorage.ts`/`export.ts`); "Editar" y click en la tarjeta/nombre suben al padre.
- **`components/MisProyectos.tsx`** — rediseño completo: tarjetas (`ProjectCard`) en vez de lista de texto plano; se retira el filtro por mob (no está en la referencia); toggle grid/lista real; nuevo prop `onProjectEdit` (distinto de `onProjectSelected`).
- **`components/App.tsx`** — nuevo `handleProjectEdit`: con 1 mob va directo al editor, con varios navega a `Proyecto.tsx` como selector (decisión de Marco, discreción explícita).
- **`projectStorage.ts`** — nueva función `duplicateProject(name)`: copia profunda con nombre autogenerado (`" (copia)"`, `" (copia 2)"`, ...).
- **`ui/Menu.tsx`** — nuevo prop opcional `triggerVariant` (aditivo, default no rompe `Editor.tsx`) para un disparador compacto (`'icon-square'`).
- **`ui/icons.tsx`** — nuevos íconos: `IconSearch`, `IconDots`, `IconGridView`, `IconListView`, `IconPencil`.

### Ticket 054 -- Íconos SVG en el menú ⋮ + botón Editar menos redondeado

- **`ui/icons.tsx`** — nuevos íconos: `IconDuplicate`, `IconExport`, `IconTrash` (reemplazan emoji en el menú "⋮" de `ProjectCard.tsx`).
- **`components/ProjectCard.tsx`** — menú "⋮" usa los íconos SVG de arriba (más `IconPencil` para "Renombrar") en vez de emoji; botón "Editar" con `border-radius: var(--radius-md)` (antes `--radius-lg`).

### Ticket 055 -- Motor de preview 2D "de frente" de un mob

- **`geometry/mobFrontSprite.ts`** (nuevo, puro) — `computeMobFrontSpriteLayout(geometry)`: calcula qué rect de la cara `front` de cada parte (via `computeBoxFaceRects`, ya existente) va a qué posición del sprite 2D, proyectando `position`/`size` ortográficamente y ordenando el dibujado por profundidad (`position[2]`).
- **`renderMobFrontSprite2D.ts`** (nuevo, DOM) — dibuja ese layout sobre un `<canvas>` real a partir de la textura guardada (`pngDataUrl` + `resolution`) y devuelve una `data:` URL.
- **`hooks/useMobFrontSprite2D.ts`** (nuevo) — hook delgado que memoiza el resultado por `(geometry, pngDataUrl, resolution)`.
- **`components/Proyecto.tsx`** — integración mínima de prueba: la miniatura de cada mob (antes la hoja de textura completa comprimida en un cuadro chico) ahora es el sprite 2D de arriba, con fallback a la textura cruda mientras la geometría/el render no terminan. El rediseño completo de esta tarjeta es el ticket 057.

### Ticket 056 -- Rediseño de layout de "Proyecto"

- **`projectStorage.ts`** — `ProjectRecord` gana `description?`/`coverImageDataUrl?` (opcionales, aditivos); nuevas `updateProjectDescription`/`updateProjectCover`.
- **`hooks/useProjectActions.ts`** (nuevo) — lógica compartida de Renombrar/Duplicar/Exportar/Eliminar, consumida por `ProjectCard.tsx` (refactorizado, sin cambio de comportamiento) y `Proyecto.tsx`.
- **`components/Proyecto.tsx`** — breadcrumb, portada subible, título/descripción editables inline, badge fijo "Minecraft Java Edition", botones de header, panel lateral "Información del proyecto" + "Acciones". Nuevo prop `onBackToList`.
- **`components/App.tsx`** — pasa `onBackToList={() => setView('mis-proyectos')}` a `Proyecto`.

### Ticket 057 -- Rediseño de tarjetas de mob dentro de "Proyecto"

- **`ui/SearchSortToggleBar.tsx`** (nuevo) — buscar + orden opcional + toggle grid/lista, extraído de `MisProyectos.tsx`.
- **`projectMobFilter.ts`** (nuevo, puro) — `filterAndSortProjectMobs`: filtra mobs de un proyecto por nombre, siempre ordenado alfabéticamente (sin `updatedAt` propio por mob).
- **`components/MobEntryCard.tsx`** (nuevo) — tarjeta de mob con miniatura 2D, archivo/dimensiones/escala derivados, "Editar textura" (mismo destino de siempre) y modal de vista previa ampliada (ícono de ojo). Reemplaza a `MobThumbnail2D` (ticket 055, retirado).
- **`components/Proyecto.tsx`** — su grid de mobs monta `SearchSortToggleBar` + `MobEntryCard` en vez del grid simple del ticket 041.
- **`components/MisProyectos.tsx`** — refactorizado para consumir `SearchSortToggleBar` (sin cambio de comportamiento).

### Ticket 058 -- Bug de preview 2D en alta resolución + fidelidad visual de tarjetas de mob

- **`renderMobFrontSprite2D.ts`** — fix: el canvas de salida se arma a la resolución REAL de la textura (antes se armaba en tamaño "x1" y se encogía la textura real al copiar, produciendo ruido de color en texturas detalladas de alta resolución).
- **`components/MobEntryCard.tsx`** — preview 2D más grande, campo "Modelo" reincorporado, ícono de ojo compacto (icon-square), tarjeta "Agregar mob" al final del grid/lista, menú "⋮" con "Eliminar mob del proyecto"; fix del modal ampliado (`width`/`height` fijos en px, no `maxWidth`/`maxHeight` ni porcentajes).
- **`projectStorage.ts`** — nueva función `removeMobFromProject(name, mobId)`.
- **`components/Proyecto.tsx`** — pasa `onRemoveMob` a cada tarjeta; nueva tarjeta "Agregar mob".
- **`components/App.tsx`** — nuevo `handleMobRemoved`/prop `onMobRemoved`: sincroniza `activeProject.mobIds` tras quitar un mob (bug real de datos desactualizados encontrado en vivo).

### Ticket 059 -- Íconos en la info + layout imagen-izquierda/detalle-derecha

- **`ui/icons.tsx`** — nuevos íconos: `IconDocument`, `IconMaximize`, `IconScale`, `IconModel`.
- **`components/MobEntryCard.tsx`** — la lista de info (archivo/dimensiones/escala/modelo) gana un ícono por línea; layout en modo grid invertido a miniatura izquierda + detalle derecha (modo lista ya tenía este orden).

### Ticket 060 -- Tarjetas más grandes, orden de botones, íconos de edición sin caja, breadcrumb más espaciado

- **`components/MobEntryCard.tsx`** — miniatura 2D en modo grid de 96px a 160px, padding/gap de la tarjeta aumentados a juego; orden de botones invertido: "Editar textura" ahora a la izquierda y el ícono de ojo ("Vista previa") a la derecha (en ambos layouts, grid y lista); modal de vista previa ampliada de 256px/230px a 340px/310px.
- **`ui/Button.tsx`** / **`index.css`** — nuevo `variant="icon-plain"`: mismo criterio de nombre accesible vía `.sr-only` que `icon-square`, pero sin fondo/borde/caja -- solo el ícono. Usado por los botones de renombrar/editar-descripción de `Proyecto.tsx` (antes `icon-square`, Marco pidió "solo el icono sin el cuadro que lo envuelve").
- **`components/Proyecto.tsx`** — botones de editar título/descripción cambiados a `icon-plain`; el grid de tarjetas de mob sube su columna mínima de 220px a 320px (a juego con la tarjeta más grande); breadcrumb ("Mis proyectos › Nombre") gana padding vertical propio para separarse más del resto del header.
- Explícitamente NO incluido (pendiente de que Marco reenvíe una imagen de referencia): cambiar la perspectiva del motor de preview 2D (`renderMobFrontSprite2D.ts`/`mobFrontSprite.ts`), que hoy sigue siendo una proyección ortográfica de frente.

### Ticket 061 -- Corrección de espaciado del breadcrumb, nombre de tarjeta más grande, subtítulo en "Agregar mob"

- **`components/Proyecto.tsx`** — breadcrumb reescrito como flex con `gap` real entre "Mis proyectos", "›" y el nombre (antes: padding vertical del ticket 060, que no era lo pedido, más espacios literales dentro del texto); card "Agregar mob" (modo grid) gana el subtítulo "Añade un nuevo mob a este proyecto.".
- **`components/MobEntryCard.tsx`** — nombre del mob en modo grid de `--font-sm` a `--font-md` (ya estaba pegado hasta arriba, sin cambio de layout ahí).
- Sigue explícitamente pendiente (imagen de referencia no llegó legible en el canal, ver el ticket): la perspectiva del motor de preview 2D.

### Ticket 062 -- Motor de preview: foto fija 3D con perspectiva "estilo wiki oficial"

Reemplaza el motor de miniaturas del ticket 055 -- ver `docs/ARQUITECTURA.md`, "Ticket 062" para la decisión de arquitectura completa (confirmada con Marco vía `AskUserQuestion`) y el detalle técnico.

- **`renderMobSnapshot3D.ts`** (nuevo, reemplaza a `renderMobFrontSprite2D.ts` + `geometry/mobFrontSprite.ts`, ambos retirados) — Three.js puro, misma geometría/UV que `Viewer3D.tsx`, mismo ángulo de cámara que el editor, `WebGLRenderer` compartido entre llamadas, devuelve una foto fija (data URL) con perspectiva de 3/4 en vez de la vista de frente plana anterior.
- **`hooks/useMobSnapshot3D.ts`** (nuevo, reemplaza a `useMobFrontSprite2D.ts`, retirado) — mismo patrón de memoización, sin el parámetro `resolution`.
- **`components/MobEntryCard.tsx`** — consume el nuevo hook; `spriteUrl` renombrado a `snapshotUrl` en todo el archivo.
