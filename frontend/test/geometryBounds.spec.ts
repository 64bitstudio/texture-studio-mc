import { describe, expect, it } from 'vitest';
import { computeGeometryCenter } from '../src/geometry/geometryBounds';
import type { MobGeometry, FaceLabels } from '../src/types/baseAssets';

const NOOP_LABELS: FaceLabels = { front: '', back: '', top: '', bottom: '', left: '', right: '' };

describe('computeGeometryCenter', () => {
  it('devuelve [0,0,0] para una geometria sin partes', () => {
    expect(computeGeometryCenter({ textureWidth: 64, textureHeight: 32, parts: {} })).toEqual([0, 0, 0]);
  });

  it('biped clasico (pies en y=0, cabeza hasta y=32): centro en [0,16,0] -- mismo valor que el target fijo anterior de Viewer3D', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        head: { size: [8, 8, 8], position: [0, 28, 0], uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
        body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 16, y: 16 }, faceLabels: NOOP_LABELS },
        armRight: { size: [2, 12, 2], position: [-5, 18, 0], uv: { x: 40, y: 16 }, faceLabels: NOOP_LABELS },
        armLeft: { size: [2, 12, 2], position: [5, 18, 0], uv: { x: 40, y: 16 }, faceLabels: NOOP_LABELS },
        legRight: { size: [2, 12, 2], position: [-2, 6, 0], uv: { x: 0, y: 16 }, faceLabels: NOOP_LABELS },
        legLeft: { size: [2, 12, 2], position: [2, 6, 0], uv: { x: 0, y: 16 }, faceLabels: NOOP_LABELS },
      },
    };
    expect(computeGeometryCenter(geometry)).toEqual([0, 16, 0]);
  });

  it('una sola caja no centrada en el origen: el centro es exactamente su propia posicion', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        thorax: { size: [6, 6, 6], position: [0, 9, 2], uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
      },
    };
    expect(computeGeometryCenter(geometry)).toEqual([0, 9, 2]);
  });

  it('bounding box combinado de varias cajas asimetricas (caso Araña: cuerpo mas pegado a un lado en z)', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        head: { size: [8, 8, 8], position: [0, 9, -7], uv: { x: 32, y: 4 }, faceLabels: NOOP_LABELS }, // z: -11..-3
        abdomen: { size: [10, 8, 12], position: [0, 9, 9], uv: { x: 0, y: 12 }, faceLabels: NOOP_LABELS }, // z: 3..15
      },
    };
    // z combinado: -11..15 -> centro z = 2 (no 0, a pesar de que cada caja individual esta centrada en x=0)
    expect(computeGeometryCenter(geometry)).toEqual([0, 9, 2]);
  });

  // Ticket 077: caja con `pivot`/`rotation` (patas de la Araña) -- el
  // bounding box debe usar la caja YA ROTADA, no `position ± size/2`
  // sin rotar (ese era el bug real: el target quedaba mas arriba de lo
  // que la pata realmente ocupa una vez rotada hacia el piso).
  it('caja con pivot/rotation de 90° en Y: el bounding box usa la caja rotada, no la caja sin rotar', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        // Sin rotar: una caja larga en X (size [16,2,2]) centrada en
        // x=8 -- ocuparia x: 0..16. Rotada 90° en Y alrededor de su
        // propio centro (pivot = position), la caja larga pasa a
        // apuntar en Z en vez de X -- debe ocupar x: 7..9, z: 0..16.
        leg: { size: [16, 2, 2], position: [8, 0, 8], uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS, pivot: [8, 0, 8], rotation: [0, 90, 0] },
      },
    };
    expect(computeGeometryCenter(geometry)).toEqual([8, 0, 8]);
  });

  it('geometria real de la Araña (ticket 077): el centro baja al incluir las patas YA rotadas hacia el piso, no la posicion sin rotar (y=9)', () => {
    const LEG_SIZE: [number, number, number] = [16, 2, 2];
    const LEG_UV = { x: 18, y: 0 };
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        head: { size: [8, 8, 8], position: [0, 9, -7], uv: { x: 32, y: 4 }, faceLabels: NOOP_LABELS },
        thorax: { size: [6, 6, 6], position: [0, 9, 0], uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
        abdomen: { size: [10, 8, 12], position: [0, 9, 9], uv: { x: 0, y: 12 }, faceLabels: NOOP_LABELS },
        leg1Right: { size: LEG_SIZE, position: [-11, 9, -1], uv: LEG_UV, faceLabels: NOOP_LABELS, pivot: [-4, 9, -1], rotation: [0, -45, 45] },
        leg1Left: { size: LEG_SIZE, position: [11, 9, -1], uv: LEG_UV, mirrorX: true, faceLabels: NOOP_LABELS, pivot: [4, 9, -1], rotation: [0, 45, -45] },
        leg2Right: { size: LEG_SIZE, position: [-11, 9, 0], uv: LEG_UV, faceLabels: NOOP_LABELS, pivot: [-4, 9, 0], rotation: [0, -22.5, 33.3] },
        leg2Left: { size: LEG_SIZE, position: [11, 9, 0], uv: LEG_UV, mirrorX: true, faceLabels: NOOP_LABELS, pivot: [4, 9, 0], rotation: [0, 22.5, -33.3] },
        leg3Right: { size: LEG_SIZE, position: [-11, 9, 1], uv: LEG_UV, faceLabels: NOOP_LABELS, pivot: [-4, 9, 1], rotation: [0, 22.5, 33.3] },
        leg3Left: { size: LEG_SIZE, position: [11, 9, 1], uv: LEG_UV, mirrorX: true, faceLabels: NOOP_LABELS, pivot: [4, 9, 1], rotation: [0, -22.5, -33.3] },
        leg4Right: { size: LEG_SIZE, position: [-11, 9, 2], uv: LEG_UV, faceLabels: NOOP_LABELS, pivot: [-4, 9, 2], rotation: [0, 45, 45] },
        leg4Left: { size: LEG_SIZE, position: [11, 9, 2], uv: LEG_UV, mirrorX: true, faceLabels: NOOP_LABELS, pivot: [4, 9, 2], rotation: [0, -45, -45] },
      },
    };
    const [cx, cy, cz] = computeGeometryCenter(geometry);
    expect(cx).toBeCloseTo(0);
    expect(cz).toBeCloseTo(2);
    // Antes del fix, cy daba 9 (posicion sin rotar de todas las cajas
    // salvo cabeza/abdomen) -- las patas rotadas SI bajan hasta y<0
    // (tocando el piso), asi que el centro real es notablemente menor.
    expect(cy).toBeCloseTo(5.343, 2);
    expect(cy).toBeLessThan(9);
  });
});
