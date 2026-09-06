// Resolucion de trabajo escalable x1-x10 (ticket 009). Modulo puro --
// sin React/DOM/three.js, mismo criterio de testabilidad que
// `textureBuffer.ts`/`history.ts`/`symmetry.ts`/`importImage.ts` (ver
// `frontend/test/resolution.spec.ts`).
//
// "Resolucion de trabajo" es un multiplicador entero sobre las
// dimensiones NATIVAS del mob (`geometry.textureWidth/Height`, ver
// `backend/src/geometry/skeletonGeometry.ts`): x1 = nativo (64x32 para
// el Esqueleto), x4 = 256x128, etc. El `TextureBuffer` real siempre
// tiene esas dimensiones exactas -- no hay un concepto de "resolucion"
// separado de "tamaño del buffer" en tiempo de ejecucion (ver
// `components/Editor.tsx`).

import { nearestSourceIndex } from './importImage';
import type { PixelSource } from './textureBuffer';

/** Resolucion de trabajo minima: x1, la resolucion nativa del mob. */
export const RESOLUTION_MIN = 1;

/** Resolucion de trabajo maxima pedida por el ticket: x10. */
export const RESOLUTION_MAX = 10;

/** Resolucion de trabajo por defecto al abrir el editor -- nativa (ticket 009, criterio de aceptacion explicito). */
export const RESOLUTION_DEFAULT = 1;

/** Recorta y redondea un multiplicador de resolucion propuesto al rango entero valido [RESOLUTION_MIN, RESOLUTION_MAX]. */
export function clampResolutionMultiplier(value: number): number {
  const rounded = Math.round(value);
  return Math.min(RESOLUTION_MAX, Math.max(RESOLUTION_MIN, rounded));
}

/**
 * Re-muestrea una fuente de pixeles (`TextureBuffer.getRawData()`
 * envuelto en un `PixelSource`, ver `components/Editor.tsx`) a nuevas
 * dimensiones, preservando el contenido ya pintado -- ticket 009,
 * cambiar de resolucion de trabajo NO debe perder lo pintado.
 *
 * Reutiliza `nearestSourceIndex` (ya validada y testeada en
 * `importImage.ts`, ticket 005) en vez de reimplementar el mismo
 * calculo: es exactamente la misma tecnica de resampling nearest-
 * neighbor con centro de texel destino, aplicada aca a la textura
 * COMPLETA en vez de a una sub-region.
 *
 * - **Escalar hacia arriba** (destino multiplo entero del origen, ej.
 *   x1 -> x4): cada pixel origen se convierte en un bloque N×N de
 *   pixeles identicos (propiedad matematica de nearest-neighbor con
 *   una relacion entera exacta -- verificado explicitamente en
 *   `resolution.spec.ts`), nunca una interpolacion suave.
 * - **Escalar hacia abajo** (ej. x4 -> x1): DECISION de este ticket
 *   (dejada a criterio explicito por el ticket 009, "documenta cual"):
 *   se toma el pixel del CENTRO de cada bloque origen que colapsa en un
 *   pixel destino (misma tecnica de "centro del texel destino" que ya
 *   usa `nearestSourceIndex`/`sampleSourceForDestPixel` para pegar
 *   imagenes, ticket 005) -- NUNCA se promedia/mezcla color entre
 *   pixeles vecinos. Se prefirio el centro del bloque en vez del pixel
 *   superior-izquierdo porque reutiliza sin duplicar la unica tecnica
 *   de resampling que ya existe y esta testeada en el proyecto, en vez
 *   de introducir una segunda convencion de "que pixel gana" solo para
 *   este caso. Consecuencia esperada (no es un bug): reducir la
 *   resolucion y volver a subirla NO reproduce pixel por pixel el
 *   contenido original si se pinto detalle fino en la resolucion alta
 *   (perdida de informacion inherente a cualquier downscale sin
 *   promediar) -- el contenido se preserva de forma razonable (un
 *   bloque solido pintado a resolucion alta se colapsa a un unico
 *   pixel del mismo color), no bit-perfect en el sentido inverso.
 */
export function resamplePixelSource(source: PixelSource, newWidth: number, newHeight: number): PixelSource {
  if (newWidth === source.width && newHeight === source.height) {
    return { width: source.width, height: source.height, data: new Uint8ClampedArray(source.data) };
  }

  const data = new Uint8ClampedArray(newWidth * newHeight * 4);
  for (let y = 0; y < newHeight; y++) {
    const sy = nearestSourceIndex(y, 0, newHeight, source.height);
    for (let x = 0; x < newWidth; x++) {
      const sx = nearestSourceIndex(x, 0, newWidth, source.width);
      const si = (sy * source.width + sx) * 4;
      const di = (y * newWidth + x) * 4;
      data[di] = source.data[si];
      data[di + 1] = source.data[si + 1];
      data[di + 2] = source.data[si + 2];
      data[di + 3] = source.data[si + 3];
    }
  }
  return { width: newWidth, height: newHeight, data };
}
