import { describe, expect, it } from 'vitest';
import { filterPointsToActiveRegion, groupDisplayLabel, isPixelInActiveRegion } from '../src/partIsolation';
import type { NamedUVRegion } from '../src/regionLabels';

// Region sintetica minima -- estos tests ejercitan solo la logica de
// contencion/filtrado de `partIsolation.ts`, no el calculo de
// rectangulos en si (eso ya lo cubre `test/regionLabels.spec.ts`).
const FACE_REGION: NamedUVRegion = {
  id: 'head.front',
  groupKey: 'head',
  face: 'front',
  label: 'Cara',
  rect: { x0: 8, y0: 8, x1: 16, y1: 16 },
};

describe('isPixelInActiveRegion', () => {
  it('sin region activa (null), cualquier pixel pertenece (modo "Mostrar todo")', () => {
    expect(isPixelInActiveRegion({ x: 0, y: 0 }, null)).toBe(true);
    expect(isPixelInActiveRegion({ x: 999, y: 999 }, null)).toBe(true);
  });

  it('un pixel dentro del rectangulo de la region pertenece', () => {
    expect(isPixelInActiveRegion({ x: 8, y: 8 }, FACE_REGION)).toBe(true); // esquina x0,y0 (incluida)
    expect(isPixelInActiveRegion({ x: 15, y: 15 }, FACE_REGION)).toBe(true); // esquina x1-1,y1-1 (incluida)
    expect(isPixelInActiveRegion({ x: 12, y: 12 }, FACE_REGION)).toBe(true); // centro
  });

  it('respeta el semiabierto [x0,x1) x [y0,y1) -- x1/y1 exactos ya NO pertenecen', () => {
    expect(isPixelInActiveRegion({ x: 16, y: 12 }, FACE_REGION)).toBe(false);
    expect(isPixelInActiveRegion({ x: 12, y: 16 }, FACE_REGION)).toBe(false);
  });

  it('un pixel fuera del rectangulo (en cualquier direccion) no pertenece', () => {
    expect(isPixelInActiveRegion({ x: 7, y: 12 }, FACE_REGION)).toBe(false); // justo a la izquierda
    expect(isPixelInActiveRegion({ x: 12, y: 7 }, FACE_REGION)).toBe(false); // justo arriba
    expect(isPixelInActiveRegion({ x: 0, y: 0 }, FACE_REGION)).toBe(false); // lejos
  });
});

describe('filterPointsToActiveRegion', () => {
  it('sin region activa, devuelve todos los puntos sin modificar', () => {
    const points = [{ x: 0, y: 0 }, { x: 999, y: 999 }];
    expect(filterPointsToActiveRegion(points, null)).toEqual(points);
  });

  it('con region activa, conserva solo los puntos dentro del rectangulo', () => {
    const points = [
      { x: 10, y: 10 }, // dentro
      { x: 0, y: 0 }, // fuera
      { x: 15, y: 15 }, // dentro (borde incluido)
      { x: 16, y: 8 }, // fuera (borde excluido)
    ];
    expect(filterPointsToActiveRegion(points, FACE_REGION)).toEqual([
      { x: 10, y: 10 },
      { x: 15, y: 15 },
    ]);
  });

  it('si ningun punto cae dentro, devuelve un arreglo vacio (nunca lanza)', () => {
    expect(filterPointsToActiveRegion([{ x: 0, y: 0 }], FACE_REGION)).toEqual([]);
  });
});

describe('groupDisplayLabel', () => {
  it('devuelve el nombre legible conocido para los 4 grupos del Esqueleto', () => {
    expect(groupDisplayLabel('head')).toBe('Cabeza');
    expect(groupDisplayLabel('body')).toBe('Torso');
    expect(groupDisplayLabel('arm')).toBe('Brazo');
    expect(groupDisplayLabel('leg')).toBe('Pierna');
  });

  it('para un groupKey desconocido, devuelve el valor capitalizado en vez de romper', () => {
    expect(groupDisplayLabel('tail')).toBe('Tail');
  });
});
