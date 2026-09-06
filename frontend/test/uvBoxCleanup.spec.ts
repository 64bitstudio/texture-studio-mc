import { describe, expect, it } from 'vitest';
import { isInsideAnyUVBox, maskPixelsOutsideUVBoxes } from '../src/uvBoxCleanup';
import { computeUVBoxRects, type UVBoxRect } from '../src/symmetry';
import type { PixelSource, RGBA } from '../src/textureBuffer';
import type { MobGeometry } from '../src/types/baseAssets';

// Mismos valores que `backend/src/geometry/skeletonGeometry.ts` (ver
// `test/symmetry.spec.ts`, duplicados aca por el mismo criterio ya
// establecido en ese archivo).
const NOOP_FACE_LABELS = { front: 'f', back: 'b', top: 't', bottom: 'bo', left: 'l', right: 'r' };

const SKELETON_GEOMETRY: MobGeometry = {
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

/** Caja "hat" real del modelo (UV (32,0)-(64,16), ver skeleton.geo.json) -- NUNCA aparece en `computeUVBoxRects` a proposito. */
const HAT_BOX: UVBoxRect = { x0: 32, y0: 0, x1: 64, y1: 16 };

const OPAQUE: RGBA = { r: 214, g: 209, b: 197, a: 255 }; // BASE_COLOR del placeholder (ver ticket 015)

function solidSource(width: number, height: number, color: RGBA): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    data[o] = color.r;
    data[o + 1] = color.g;
    data[o + 2] = color.b;
    data[o + 3] = color.a;
  }
  return { width, height, data };
}

function readPixel(source: PixelSource, x: number, y: number): RGBA {
  const i = (y * source.width + x) * 4;
  return { r: source.data[i], g: source.data[i + 1], b: source.data[i + 2], a: source.data[i + 3] };
}

describe('isInsideAnyUVBox', () => {
  const boxes = computeUVBoxRects(SKELETON_GEOMETRY);

  it('es true dentro de una caja UV conocida (cabeza)', () => {
    expect(isInsideAnyUVBox(0, 0, boxes)).toBe(true);
    expect(isInsideAnyUVBox(31, 15, boxes)).toBe(true);
  });

  it('es false dentro de la caja "hat" (no modelada, UV (32,0)-(64,16))', () => {
    expect(isInsideAnyUVBox(32, 0, boxes)).toBe(false);
    expect(isInsideAnyUVBox(63, 15, boxes)).toBe(false);
  });
});

describe('maskPixelsOutsideUVBoxes', () => {
  it('fuerza alpha=0 en el 100% de la region "hat" (32,0)-(64,16) a resolucion nativa x1', () => {
    const boxes = computeUVBoxRects(SKELETON_GEOMETRY, 1);
    const source = solidSource(64, 32, OPAQUE);

    const cleaned = maskPixelsOutsideUVBoxes(source, boxes);

    for (let y = HAT_BOX.y0; y < HAT_BOX.y1; y++) {
      for (let x = HAT_BOX.x0; x < HAT_BOX.x1; x++) {
        expect(readPixel(cleaned, x, y).a).toBe(0);
      }
    }
  });

  it('fuerza alpha=0 en la region "hat" tambien a resolucion escalada x4 (mismo criterio de `scale` que `computeUVBoxRects`)', () => {
    const scale = 4;
    const boxes = computeUVBoxRects(SKELETON_GEOMETRY, scale);
    const source = solidSource(64 * scale, 32 * scale, OPAQUE);

    const cleaned = maskPixelsOutsideUVBoxes(source, boxes);

    const hatX0 = HAT_BOX.x0 * scale;
    const hatY0 = HAT_BOX.y0 * scale;
    const hatX1 = HAT_BOX.x1 * scale;
    const hatY1 = HAT_BOX.y1 * scale;
    for (let y = hatY0; y < hatY1; y++) {
      for (let x = hatX0; x < hatX1; x++) {
        expect(readPixel(cleaned, x, y).a).toBe(0);
      }
    }
  });

  it('NO toca ningun pixel dentro de una caja UV valida (contenido real de la cabeza intacto)', () => {
    const boxes = computeUVBoxRects(SKELETON_GEOMETRY, 1);
    const source = solidSource(64, 32, OPAQUE);
    // "Pinta" un pixel distintivo dentro de la caja de la cabeza.
    const distinctive: RGBA = { r: 12, g: 34, b: 56, a: 200 };
    const i = 5 * 4;
    source.data[i] = distinctive.r;
    source.data[i + 1] = distinctive.g;
    source.data[i + 2] = distinctive.b;
    source.data[i + 3] = distinctive.a;

    const cleaned = maskPixelsOutsideUVBoxes(source, boxes);

    expect(readPixel(cleaned, 5, 0)).toEqual(distinctive);
    // El resto de la caja de cabeza (no tocado por el "pintado" de arriba) tampoco cambia.
    expect(readPixel(cleaned, 0, 0)).toEqual(OPAQUE);
  });

  it('nunca muta el `PixelSource` original (devuelve datos clonados)', () => {
    const boxes = computeUVBoxRects(SKELETON_GEOMETRY, 1);
    const source = solidSource(64, 32, OPAQUE);
    const originalCopy = new Uint8ClampedArray(source.data);

    maskPixelsOutsideUVBoxes(source, boxes);

    expect(source.data).toEqual(originalCopy);
  });

  it('deja RGB sin tocar fuera de las cajas -- solo fuerza el canal alpha', () => {
    const boxes = computeUVBoxRects(SKELETON_GEOMETRY, 1);
    const source = solidSource(64, 32, OPAQUE);

    const cleaned = maskPixelsOutsideUVBoxes(source, boxes);
    const hatPixel = readPixel(cleaned, 32, 0);

    expect(hatPixel.r).toBe(OPAQUE.r);
    expect(hatPixel.g).toBe(OPAQUE.g);
    expect(hatPixel.b).toBe(OPAQUE.b);
    expect(hatPixel.a).toBe(0);
  });
});
