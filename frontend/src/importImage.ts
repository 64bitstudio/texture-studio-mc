// Logica pura de importar/pegar imagen (ticket 005, HU-8/HU-9: ver
// docs/definiciones/editor-3d-texturas-esqueleto.md).
//
// Deliberadamente sin React/DOM/three.js -- mismo criterio de
// testabilidad que `textureBuffer.ts`/`history.ts`/`symmetry.ts`/
// `zoom.ts` (ver `frontend/test/importImage.spec.ts`). Todo lo que
// toca el DOM (decodificar un `File`/`Blob` a pixeles, manejo de
// eventos de puntero para arrastrar/redimensionar) vive en
// `decodeTexture.ts` y en los componentes (`Editor.tsx`,
// `components/PasteImageOverlay.tsx`).

import type { PixelChange } from './history';
import type { PixelPoint, PixelSource, RGBA } from './textureBuffer';
import type { UVBoxRect } from './symmetry';

/** Dimensiones simples (ancho/alto), sin depender de un `File`/`Image` real -- testeable con objetos planos. */
export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Valida que una imagen recien decodificada mida EXACTAMENTE
 * `expected` (HU-8, criterio "rechaza el archivo con un mensaje de
 * error claro"). Devuelve `null` si es valida, o el mensaje de error a
 * mostrar en la UI (nunca un `alert()` del navegador -- ver
 * `components/ImportTextureControl.tsx`).
 */
export function validateImportDimensions(actual: ImageDimensions, expected: ImageDimensions): string | null {
  if (actual.width === expected.width && actual.height === expected.height) return null;
  return `El PNG debe medir exactamente ${expected.width}×${expected.height} px (se recibió ${actual.width}×${actual.height} px).`;
}

/**
 * Diff pixel a pixel entre el contenido actual del buffer y una imagen
 * nueva de las MISMAS dimensiones (el llamador ya valido eso con
 * `validateImportDimensions`) -- HU-8. Devuelve solo los pixeles que
 * realmente cambian, en el mismo shape (`PixelChange`) que usa
 * `PaintHistory` para un trazo (ver `history.ts`): el reemplazo
 * completo del buffer se registra como UNA unica unidad de undo
 * reutilizando `beginStroke`/`recordChange`/`commitStroke` tal cual,
 * sin necesidad de una API de historial nueva ni distinta para "un
 * reemplazo completo" (ver `components/Editor.tsx`).
 */
export function computeFullReplaceDiff(current: PixelSource, next: PixelSource): PixelChange[] {
  const changes: PixelChange[] = [];
  const total = current.width * current.height;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const before: RGBA = { r: current.data[o], g: current.data[o + 1], b: current.data[o + 2], a: current.data[o + 3] };
    const after: RGBA = { r: next.data[o], g: next.data[o + 1], b: next.data[o + 2], a: next.data[o + 3] };
    if (before.r !== after.r || before.g !== after.g || before.b !== after.b || before.a !== after.a) {
      changes.push({ x: i % current.width, y: Math.floor(i / current.width), before, after });
    }
  }
  return changes;
}

/**
 * Rectangulo del overlay de "pegar imagen" (HU-9), en espacio de
 * texeles de la textura (misma unidad que `UVBoxRect`). Coordenadas
 * SIEMPRE enteras -- decision de este ticket: al ser un editor pixel
 * art (igual que el resto del editor, que ya trabaja en texeles
 * enteros, nunca sub-pixel), arrastrar/redimensionar el overlay
 * tambien snapea a la cuadricula de texeles en cada paso, no solo al
 * confirmar. Esto evita tener que arrastrar aritmetica de rectangulos
 * flotantes por todo el modulo (recorte a caja UV, mapeo de resampling)
 * sin ninguna perdida de expresividad real para el caso de uso.
 */
export interface OverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calcula el rectangulo inicial del overlay (HU-9, criterio de
 * aceptacion "posicionado inicialmente sobre alguna region razonable").
 * Decision de este ticket: se ajusta ("contain", puede agrandar o
 * achicar la imagen) preservando la proporcion original, centrado
 * dentro de `box` -- redondeado a texeles enteros, minimo 1x1. El
 * llamador (`Editor.tsx`) le pasa la PRIMERA caja UV que devuelve
 * `computeUVBoxRects(geometry)` (la cabeza, en el orden actual de
 * `skeletonGeometry.ts`) -- eleccion arbitraria pero deterministica
 * entre "centrada en el canvas completo" y "sobre la primera caja UV"
 * que dejaba abierta el ticket; se prefirio la caja UV porque ya deja
 * la imagen lista para encajar en una region real del modelo en vez de
 * en una zona de relleno sin uso del layout clasico 64x32.
 */
export function fitRectToBox(image: ImageDimensions, box: UVBoxRect): OverlayRect {
  const boxWidth = box.x1 - box.x0;
  const boxHeight = box.y1 - box.y0;
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const x = box.x0 + Math.round((boxWidth - width) / 2);
  const y = box.y0 + Math.round((boxHeight - height) / 2);
  return { x, y, width, height };
}

/**
 * Rectangulo inicial EXACTO del overlay cuando hay una parte aislada
 * activa (ticket 012) al pegar/subir una imagen (ticket 013). A
 * diferencia de `fitRectToBox` (ajuste por CONTENCION: preserva la
 * proporcion original de la imagen, puede dejar franjas de la caja sin
 * cubrir), este ajuste ESTIRA la imagen -- escalado no uniforme en X/Y
 * si hace falta -- para ocupar exactamente la region activa completa.
 * Decision explicita de este ticket, no una reinterpretacion de
 * `fitRectToBox`: el criterio de aceptacion pide que el overlay quede
 * "ajustado exactamente a los pixeles de la region... sin necesidad de
 * ajuste manual previo a confirmar" -- con un ajuste por contencion,
 * una imagen de proporcion distinta a la de la region seguiria dejando
 * pixeles de esta sin cubrir, obligando igual a un ajuste manual para
 * completarla (justo lo que Marco pidio evitar, ver
 * `pending/013-pegar-imagen-ajuste-automatico-parte.md`). El
 * resampling real (nearest-neighbor) ocurre despues, al confirmar, en
 * `computeBurnPixels`/`sampleSourceForDestPixel` -- esta funcion solo
 * fija la posicion/tamaño INICIAL del overlay (el usuario puede seguir
 * moviendolo/redimensionandolo libremente antes de confirmar, ver
 * `computeInitialPasteRect`).
 */
export function fitRectToRegionExact(region: UVBoxRect): OverlayRect {
  return {
    x: region.x0,
    y: region.y0,
    width: Math.max(1, region.x1 - region.x0),
    height: Math.max(1, region.y1 - region.y0),
  };
}

/**
 * Punto de entrada UNICO para calcular el rect inicial del overlay de
 * pegado/insertar imagen (ticket 005 HU-9 + ticket 013, aditivo):
 *
 * - Con una parte aislada activa (`activeRegion` no nulo, ver
 *   `Editor.tsx`/`isolatedRegion` del ticket 012): ajusta EXACTO a sus
 *   dimensiones (`fitRectToRegionExact`) -- deliberadamente IGNORA
 *   `image` (la proporcion/tamaño original de la imagen fuente no
 *   importa, el ajuste automatico cubre la region completa sin dejar
 *   pixeles sin cubrir, ver comentario de `fitRectToRegionExact`).
 * - Sin parte aislada (`activeRegion === null`): comportamiento EXACTO
 *   del ticket 005, SIN CAMBIOS -- `fitRectToBox` contra `fallbackBox`
 *   (la primera caja UV que expone `Editor.tsx`), o el tamaño original
 *   de la imagen centrado en el origen si no hay ninguna caja UV
 *   conocida (mismo fallback que ya existia).
 */
export function computeInitialPasteRect(
  image: ImageDimensions,
  activeRegion: UVBoxRect | null,
  fallbackBox: UVBoxRect | null,
): OverlayRect {
  if (activeRegion) return fitRectToRegionExact(activeRegion);
  if (fallbackBox) return fitRectToBox(image, fallbackBox);
  return { x: 0, y: 0, width: image.width, height: image.height };
}

/**
 * Interseccion entre `rect` y `box`, o `null` si no se superponen.
 * Ambos en el mismo espacio de texeles semiabierto `[x0,x1) x [y0,y1)`
 * que ya usa `UVBoxRect` (ver `symmetry.ts`).
 */
export function clampRectToBox(rect: OverlayRect, box: UVBoxRect): UVBoxRect | null {
  const x0 = Math.max(rect.x, box.x0);
  const y0 = Math.max(rect.y, box.y0);
  const x1 = Math.min(rect.x + rect.width, box.x1);
  const y1 = Math.min(rect.y + rect.height, box.y1);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, x1, y1 };
}

/**
 * Determina a que caja UV "pertenece" el overlay -- la de MAYOR area de
 * superposicion con `rect` -- o `null` si el overlay no se superpone
 * con ninguna caja UV conocida (ej. quedo enteramente sobre una zona de
 * relleno del layout clasico 64x32). Este es el mecanismo central del
 * gotcha documentado en el ticket: "el desgarre de una region nunca
 * debe estirarse mas alla de su propio borde de caja hacia OTRA caja
 * UV" -- se elige UNA sola caja objetivo (nunca se reparte el quemado
 * entre dos cajas distintas aunque el overlay las toque a ambas) y
 * `computeBurnPixels` recorta el resultado exclusivamente a esa caja.
 */
export function findTargetUVBox(rect: OverlayRect, boxes: UVBoxRect[]): UVBoxRect | null {
  let best: UVBoxRect | null = null;
  let bestArea = 0;
  for (const box of boxes) {
    const clamped = clampRectToBox(rect, box);
    if (!clamped) continue;
    const area = (clamped.x1 - clamped.x0) * (clamped.y1 - clamped.y0);
    if (area > bestArea) {
      bestArea = area;
      best = box;
    }
  }
  return best;
}

/**
 * Indice de texel de la imagen FUENTE mas cercano (resampling
 * nearest-neighbor, no interpolacion suave -- criterio explicito del
 * ticket para mantener el estilo pixel-art) que corresponde a un texel
 * DESTINO `destIndex` dentro de un rectangulo destino que arranca en
 * `rectOrigin` y mide `rectSize` texeles, cuando la fuente mide
 * `sourceSize` texeles en ese mismo eje. Usa el CENTRO del texel
 * destino (`+0.5`) para la fraccion -- tecnica estandar de resampling
 * nearest-neighbor, evita sesgar sistematicamente hacia un extremo.
 * Recortado a `[0, sourceSize-1]` (clamp-to-edge) para cualquier
 * `destIndex` en el borde exacto del rectangulo.
 */
export function nearestSourceIndex(destIndex: number, rectOrigin: number, rectSize: number, sourceSize: number): number {
  const fraction = (destIndex - rectOrigin + 0.5) / rectSize;
  const index = Math.floor(fraction * sourceSize);
  return Math.min(Math.max(index, 0), sourceSize - 1);
}

function readPixel(source: PixelSource, x: number, y: number): RGBA {
  const cx = Math.min(Math.max(x, 0), source.width - 1);
  const cy = Math.min(Math.max(y, 0), source.height - 1);
  const i = (cy * source.width + cx) * 4;
  return { r: source.data[i], g: source.data[i + 1], b: source.data[i + 2], a: source.data[i + 3] };
}

/**
 * Resampling nearest-neighbor: color de `source` que corresponde al
 * texel destino `destPixel`, cuando `source` se estira/encoge para
 * llenar exactamente `rect` (en espacio de texeles de la textura).
 * Funcion pura y testeable por separado del resto de `computeBurnPixels`
 * -- ver criterio de verificacion del ticket ("aplicacion del
 * resampling nearest-neighbor si la extraes a una funcion testeable").
 */
export function sampleSourceForDestPixel(source: PixelSource, destPixel: PixelPoint, rect: OverlayRect): RGBA {
  const sx = nearestSourceIndex(destPixel.x, rect.x, rect.width, source.width);
  const sy = nearestSourceIndex(destPixel.y, rect.y, rect.height, source.height);
  return readPixel(source, sx, sy);
}

/** Un pixel a escribir en el `TextureBuffer`, ya resuelto a coordenadas de textura + color final. */
export interface PixelWrite {
  x: number;
  y: number;
  color: RGBA;
}

/**
 * Orquesta el "quemado" completo de HU-9: determina la caja UV
 * objetivo (`findTargetUVBox`), recorta el overlay a sus limites
 * (`clampRectToBox`) y resuelve el color de cada texel destino dentro
 * de esa region recortada por resampling nearest-neighbor
 * (`sampleSourceForDestPixel`) contra el rectangulo COMPLETO del
 * overlay (no el recortado) -- para que la imagen se vea estirada de
 * forma continua a traves del recorte, en vez de que la porcion visible
 * dentro de la caja UV sea solo un sub-recorte de la imagen fuente.
 *
 * Devuelve `null` cuando el overlay no se superpone con ninguna caja UV
 * conocida -- "nada que quemar", el llamador (`Editor.tsx`) lo trata
 * como un error de UI explicito, no como un no-op silencioso (ver
 * `pasteError` en `Editor.tsx`).
 */
export function computeBurnPixels(source: PixelSource, rect: OverlayRect, boxes: UVBoxRect[]): PixelWrite[] | null {
  const targetBox = findTargetUVBox(rect, boxes);
  if (!targetBox) return null;
  const clamped = clampRectToBox(rect, targetBox);
  if (!clamped) return null;

  const writes: PixelWrite[] = [];
  for (let y = clamped.y0; y < clamped.y1; y++) {
    for (let x = clamped.x0; x < clamped.x1; x++) {
      writes.push({ x, y, color: sampleSourceForDestPixel(source, { x, y }, rect) });
    }
  }
  return writes;
}
