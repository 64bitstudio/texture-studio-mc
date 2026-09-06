// Simetria de pintura (ticket 004, HU-6: ver
// docs/definiciones/editor-3d-texturas-esqueleto.md).
//
// Deliberadamente puro -- sin React/DOM/three.js -- mismo criterio de
// testabilidad que `textureBuffer.ts`/`history.ts` (ver
// `frontend/test/symmetry.spec.ts`).
//
// DECISION DE ESTE TICKET (no estaba especificada, ver docs/ARQUITECTURA.md
// "Ticket 004" para la justificacion completa con los numeros derivados):
// se ofrece UN SOLO eje de simetria -- espejo HORIZONTAL (eje vertical
// central) dentro de la caja UV completa de cada parte del modelo --
// en vez de un selector de eje horizontal/vertical. La caja UV de cada
// parte es su rectangulo "cross" completo tal como lo calcula
// `applyBoxUV.ts` (las 6 caras -- top/bottom/front/back/left/right --
// desenrolladas en un unico rectangulo), NO solo la cara frontal.
//
// Por que no se ofrece tambien un eje vertical: un espejo vertical
// (arriba/abajo) de esa misma caja completa solo produce un mapeo
// geometricamente coherente cuando la profundidad (d) y la altura (h)
// de la caja son iguales (la fila superior del "cross", de alto d,
// tendria que coincidir en tamaño con la fila inferior, de alto h).
// Eso solo se cumple para la cabeza (d=h=8, un cubo). Para
// torso/brazo/pierna (d=4, h=12) un espejo vertical mezclaria una
// franja de 4px con una de 12px sin una correspondencia 1:1 real. El
// espejo horizontal, en cambio, siempre es una biyeccion perfectamente
// definida sobre el ancho total de la caja (2*d + 2*w) sin importar
// los valores de d/h -- funciona igual de bien para las 4 cajas UV
// distintas del modelo. Ver docs/ARQUITECTURA.md para el detalle
// caja por caja (incluyendo el caso del torso, donde d != w y el
// espejo horizontal cruza cara frontal/lateral en vez de alinear
// exactamente frente-con-frente).

import type { PixelPoint } from './textureBuffer';
import type { SkeletonGeometry } from './types/baseAssets';

/** Rectangulo de pixeles de textura, semiabierto: [x0,x1) x [y0,y1). */
export interface UVBoxRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Deriva, a partir de la geometria servida por el backend (fuente de
 * verdad, ver `backend/src/geometry/skeletonGeometry.ts`), el
 * rectangulo UV "cross" completo de cada parte -- misma formula que
 * `applyBoxUV.ts` usa para las 6 sub-caras, pero aca solo se necesita
 * el rectangulo contenedor total: ancho = 2*d + 2*w, alto = d + h,
 * origen en `part.uv`.
 *
 * `armRight`/`armLeft` (y `legRight`/`legLeft`) apuntan exactamente al
 * mismo origen UV con el mismo tamaño (el formato clasico 64x32
 * reutiliza la region del lado derecho para el izquierdo, ver
 * `mirrorX` en `skeletonGeometry.ts`) -- por lo tanto producen el
 * MISMO rectangulo. Esta funcion deduplica esos rectangulos repetidos:
 * el resultado tiene como maximo un rectangulo por region de pixeles
 * realmente distinta (4 para el Esqueleto: cabeza, torso, brazo,
 * pierna), nunca dos rectangulos identicos.
 *
 * `scale` (ticket 009, resolucion de trabajo escalable x1-x10): la
 * geometria del backend siempre describe el UV en pixeles NATIVOS
 * (x1) -- cuando el `TextureBuffer` activo trabaja a una resolucion
 * mayor (`components/Editor.tsx`, `resolution.ts`), sus pixeles NO se
 * corresponden 1:1 con esas coordenadas nativas. `scale` (default 1,
 * compatible con todo el codigo/tests previos a este ticket) multiplica
 * el rectangulo completo -- equivalente a escalar `uv.x/y` y `w/h/d`
 * por separado antes de sumarlos, porque la formula del rectangulo es
 * lineal en esos terminos.
 */
export function computeUVBoxRects(geometry: SkeletonGeometry, scale: number = 1): UVBoxRect[] {
  const seen = new Set<string>();
  const rects: UVBoxRect[] = [];

  for (const part of Object.values(geometry.parts)) {
    const [w, h, d] = part.size;
    const rect: UVBoxRect = {
      x0: part.uv.x * scale,
      y0: part.uv.y * scale,
      x1: (part.uv.x + 2 * d + 2 * w) * scale,
      y1: (part.uv.y + d + h) * scale,
    };
    const key = `${rect.x0},${rect.y0},${rect.x1},${rect.y1}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rects.push(rect);
  }

  return rects;
}

/**
 * Devuelve la caja UV que contiene `point`, o `null` si cae en una zona
 * de relleno del layout clasico 64x32 ajena a las cajas conocidas.
 * Exportada desde el ticket 015 (limpieza de zonas no editables al
 * exportar, ver `uvBoxCleanup.ts`) para no duplicar este mismo chequeo
 * de pertenencia -- ya se usaba internamente aca para `mirrorPointHorizontal`.
 */
export function findContainingBox(point: PixelPoint, boxes: UVBoxRect[]): UVBoxRect | null {
  for (const box of boxes) {
    if (point.x >= box.x0 && point.x < box.x1 && point.y >= box.y0 && point.y < box.y1) {
      return box;
    }
  }
  return null;
}

/**
 * Calcula la contraparte simetrica (espejo horizontal) de `point`
 * dentro de la caja UV que lo contiene. Devuelve `null` en dos casos,
 * ambos "no hay una contraparte distinta que pintar":
 *
 * - `point` no cae dentro de ninguna caja UV conocida (zonas de
 *   relleno del layout clasico 64x32, ej. la franja sin usar a la
 *   derecha del brazo -- ver docs/ARQUITECTURA.md).
 * - `point` cae exactamente en la columna central de una caja de
 *   ancho impar (su propio espejo es el mismo pixel).
 */
export function mirrorPointHorizontal(point: PixelPoint, boxes: UVBoxRect[]): PixelPoint | null {
  const box = findContainingBox(point, boxes);
  if (!box) return null;

  const mirroredX = box.x0 + box.x1 - 1 - point.x;
  if (mirroredX === point.x) return null;

  return { x: mirroredX, y: point.y };
}
