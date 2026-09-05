import { describe, expect, it } from 'vitest';
import { computeUVBoxRects, mirrorPointHorizontal, type UVBoxRect } from '../src/symmetry';
import type { SkeletonGeometry } from '../src/types/baseAssets';

// Mismos valores que `backend/src/geometry/skeletonGeometry.ts` (formato
// clasico 64x32 del Esqueleto/Player) -- duplicados aca a proposito,
// igual que `frontend/src/types/baseAssets.ts` ya duplica el contrato
// del backend (ver docs/ARQUITECTURA.md).
const SKELETON_GEOMETRY: SkeletonGeometry = {
  textureWidth: 64,
  textureHeight: 32,
  parts: {
    head: { size: [8, 8, 8], position: [0, 28, 0], uv: { x: 0, y: 0 } },
    body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 16, y: 16 } },
    armRight: { size: [4, 12, 4], position: [-6, 18, 0], uv: { x: 40, y: 16 } },
    armLeft: { size: [4, 12, 4], position: [6, 18, 0], uv: { x: 40, y: 16 }, mirrorX: true },
    legRight: { size: [4, 12, 4], position: [-2, 6, 0], uv: { x: 0, y: 16 } },
    legLeft: { size: [4, 12, 4], position: [2, 6, 0], uv: { x: 0, y: 16 }, mirrorX: true },
  },
};

describe('computeUVBoxRects', () => {
  it('deriva las 4 cajas UV distintas del Esqueleto (64x32) a partir de la geometria', () => {
    const rects = computeUVBoxRects(SKELETON_GEOMETRY);

    // 6 partes, pero armRight/armLeft comparten caja y legRight/legLeft
    // tambien -- deduplicadas, quedan 4 cajas distintas.
    expect(rects).toHaveLength(4);

    expect(rects).toContainEqual({ x0: 0, y0: 0, x1: 32, y1: 16 }); // cabeza
    expect(rects).toContainEqual({ x0: 16, y0: 16, x1: 40, y1: 32 }); // torso
    expect(rects).toContainEqual({ x0: 40, y0: 16, x1: 56, y1: 32 }); // brazo (compartida)
    expect(rects).toContainEqual({ x0: 0, y0: 16, x1: 16, y1: 32 }); // pierna (compartida)
  });

  it('no duplica el rectangulo de armRight/armLeft ni el de legRight/legLeft', () => {
    const rects = computeUVBoxRects(SKELETON_GEOMETRY);
    const key = (r: UVBoxRect) => `${r.x0},${r.y0},${r.x1},${r.y1}`;
    const keys = rects.map(key);
    expect(new Set(keys).size).toBe(keys.length);
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
