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
});
