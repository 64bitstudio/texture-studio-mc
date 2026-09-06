import { describe, expect, it } from 'vitest';
import { computeUVBoxRects, mirrorPointHorizontal, type UVBoxRect } from '../src/symmetry';
import type { SkeletonGeometry } from '../src/types/baseAssets';

// Mismos valores que `backend/src/geometry/skeletonGeometry.ts` (formato
// clasico 64x32 del Esqueleto/Player, YA con la correccion del ticket
// 009 -- brazos/piernas delgados [2,12,2]) -- duplicados aca a
// proposito, igual que `frontend/src/types/baseAssets.ts` ya duplica el
// contrato del backend (ver docs/ARQUITECTURA.md).
//
// `faceLabels` (ticket 011) es un campo requerido del contrato desde
// este ticket -- el contenido exacto no importa para estos tests (no
// ejercitan `regionLabels.ts`, ver `test/regionLabels.spec.ts` para
// eso), solo debe estar presente para que el fixture siga
// satisfaciendo el tipo `SkeletonGeometry`.
const NOOP_FACE_LABELS = { front: 'f', back: 'b', top: 't', bottom: 'bo', left: 'l', right: 'r' };

const SKELETON_GEOMETRY: SkeletonGeometry = {
  textureWidth: 64,
  textureHeight: 32,
  parts: {
    head: { size: [8, 8, 8], position: [0, 28, 0], uv: { x: 0, y: 0 }, faceLabels: NOOP_FACE_LABELS },
    body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 16, y: 16 }, faceLabels: NOOP_FACE_LABELS },
    armRight: { size: [2, 12, 2], position: [-5, 18, 0], uv: { x: 40, y: 16 }, faceLabels: NOOP_FACE_LABELS },
    armLeft: {
      size: [2, 12, 2],
      position: [5, 18, 0],
      uv: { x: 40, y: 16 },
      mirrorX: true,
      faceLabels: NOOP_FACE_LABELS,
    },
    legRight: { size: [2, 12, 2], position: [-2, 6, 0], uv: { x: 0, y: 16 }, faceLabels: NOOP_FACE_LABELS },
    legLeft: {
      size: [2, 12, 2],
      position: [2, 6, 0],
      uv: { x: 0, y: 16 },
      mirrorX: true,
      faceLabels: NOOP_FACE_LABELS,
    },
  },
};

describe('computeUVBoxRects', () => {
  it('deriva las 4 cajas UV distintas del Esqueleto (64x32) a partir de la geometria', () => {
    const rects = computeUVBoxRects(SKELETON_GEOMETRY);

    // 6 partes, pero armRight/armLeft comparten caja y legRight/legLeft
    // tambien -- deduplicadas, quedan 4 cajas distintas. Brazo/pierna
    // miden 8 columnas de ancho (2*d+2*w = 2*2+2*2), no 16 -- ver el
    // ticket 009 (verificacion empirica contra el skeleton.png real).
    expect(rects).toHaveLength(4);

    expect(rects).toContainEqual({ x0: 0, y0: 0, x1: 32, y1: 16 }); // cabeza
    expect(rects).toContainEqual({ x0: 16, y0: 16, x1: 40, y1: 32 }); // torso
    expect(rects).toContainEqual({ x0: 40, y0: 16, x1: 48, y1: 30 }); // brazo (compartida)
    expect(rects).toContainEqual({ x0: 0, y0: 16, x1: 8, y1: 30 }); // pierna (compartida)
  });

  it('no duplica el rectangulo de armRight/armLeft ni el de legRight/legLeft', () => {
    const rects = computeUVBoxRects(SKELETON_GEOMETRY);
    const key = (r: UVBoxRect) => `${r.x0},${r.y0},${r.x1},${r.y1}`;
    const keys = rects.map(key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('ticket 009: `scale` multiplica el rectangulo completo -- resolucion de trabajo x1-x10', () => {
    const nativeRects = computeUVBoxRects(SKELETON_GEOMETRY);
    const scaledRects = computeUVBoxRects(SKELETON_GEOMETRY, 4);

    expect(scaledRects).toHaveLength(nativeRects.length);
    for (const rect of nativeRects) {
      expect(scaledRects).toContainEqual({ x0: rect.x0 * 4, y0: rect.y0 * 4, x1: rect.x1 * 4, y1: rect.y1 * 4 });
    }
  });

  it('ticket 009: scale=1 (default) es identico a no pasar el parametro -- compatible con el resto de tests/llamadores previos', () => {
    expect(computeUVBoxRects(SKELETON_GEOMETRY, 1)).toEqual(computeUVBoxRects(SKELETON_GEOMETRY));
  });
});

describe('mirrorPointHorizontal', () => {
  const rects = computeUVBoxRects(SKELETON_GEOMETRY);

  it('espeja un pixel cerca del borde izquierdo de la caja de la cabeza hacia el borde derecho, misma fila', () => {
    // Caja cabeza: x0=0, x1=32 -> centro entre columnas 15/16.
    expect(mirrorPointHorizontal({ x: 0, y: 5 }, rects)).toEqual({ x: 31, y: 5 });
    expect(mirrorPointHorizontal({ x: 2, y: 12 }, rects)).toEqual({ x: 29, y: 12 });
  });

  it('es su propia inversa dentro de la misma caja (aplicar el espejo dos veces devuelve el pixel original)', () => {
    const original = { x: 41, y: 20 }; // dentro de la caja del brazo (40,16)-(56,32)
    const mirrored = mirrorPointHorizontal(original, rects);
    expect(mirrored).not.toBeNull();
    expect(mirrorPointHorizontal(mirrored!, rects)).toEqual(original);
  });

  it('devuelve null cuando el pixel no cae dentro de ninguna caja UV conocida (zona de relleno del layout 64x32)', () => {
    // x:56-64, y:16-32 no pertenece a ninguna de las 4 cajas (relleno del
    // formato clasico a la derecha del brazo).
    expect(mirrorPointHorizontal({ x: 60, y: 20 }, rects)).toBeNull();
    // x:32-64, y:0-16 tampoco pertenece a ninguna caja (relleno arriba).
    expect(mirrorPointHorizontal({ x: 50, y: 5 }, rects)).toBeNull();
  });

  it('devuelve null cuando el pixel esta en la columna central de una caja de ancho impar (sin contraparte distinta)', () => {
    const oddBox: UVBoxRect = { x0: 0, y0: 0, x1: 5, y1: 5 }; // ancho 5 (impar), centro en x=2
    expect(mirrorPointHorizontal({ x: 2, y: 3 }, [oddBox])).toBeNull();
    // Confirma que el resto de columnas de esa misma caja si espeja normalmente.
    expect(mirrorPointHorizontal({ x: 0, y: 3 }, [oddBox])).toEqual({ x: 4, y: 3 });
  });
});
