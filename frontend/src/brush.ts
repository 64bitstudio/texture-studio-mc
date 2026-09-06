// Pincel de tamaño ajustable de la herramienta de borrado (ticket 030,
// HU-5). Deliberadamente puro -- sin React/DOM -- mismo criterio de
// testabilidad que `textureBuffer.ts`/`symmetry.ts` (ver
// `frontend/test/brush.spec.ts`). Alcance explícito del ticket: SOLO
// afecta al modo "Borrar", no al pincel de pintar normal (que sigue
// siendo un pixel por punto, ver `docs/definiciones/
// rediseno-ux-ui-y-navegacion.md`, "No incluye").

import type { PixelPoint } from './textureBuffer';

/**
 * Bloque cuadrado de `size`×`size` píxeles centrado en `center`. Para
 * `size` par, el centro real cae entre dos filas/columnas -- se
 * redondea hacia -x/-y (mismo criterio simple y determinista que
 * `Math.floor`, sin inventar una segunda convención de centrado
 * distinta a la ya usada en el proyecto para resampleo, ver
 * `resolution.ts`).
 */
export function computeBrushFootprint(center: PixelPoint, size: number): PixelPoint[] {
  if (size <= 1) return [center];

  const half = Math.floor(size / 2);
  const points: PixelPoint[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      points.push({ x: center.x - half + dx, y: center.y - half + dy });
    }
  }
  return points;
}

/** Footprint de una LÍNEA de puntos (ej. un arrastre) -- cada punto de `linePoints` expande a su propio bloque, sin duplicar (la deduplicación real la hace `applyPixelsWithSymmetry`, este helper solo genera la lista completa). */
export function computeBrushFootprintForLine(linePoints: PixelPoint[], size: number): PixelPoint[] {
  if (size <= 1) return linePoints;
  return linePoints.flatMap((p) => computeBrushFootprint(p, size));
}
