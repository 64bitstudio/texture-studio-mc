import { describe, expect, it } from 'vitest';
import { computeMobFrontSpriteLayout } from '../src/geometry/mobFrontSprite';
import type { FaceLabels, MobGeometry } from '../src/types/baseAssets';

const NOOP_LABELS: FaceLabels = { front: '', back: '', top: '', bottom: '', left: '', right: '' };

describe('computeMobFrontSpriteLayout', () => {
  it('una sola caja: el sprite mide exactamente su tamaño + el padding, y su rect de destino arranca en (padding, padding)', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        head: { size: [8, 8, 8], position: [0, 0, 0], uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
      },
    };

    const layout = computeMobFrontSpriteLayout(geometry);

    expect(layout.width).toBe(10); // 8 + 1 (padding) * 2
    expect(layout.height).toBe(10);
    expect(layout.draws).toHaveLength(1);
    expect(layout.draws[0]).toMatchObject({ destX: 1, destY: 1, destWidth: 8, destHeight: 8, flipX: false });
  });

  it('biped clasico: la cabeza queda arriba (destY menor) que las piernas -- Y de Minecraft se invierte a Y de pantalla', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        head: { size: [8, 8, 8], position: [0, 28, 0], uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
        body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 16, y: 16 }, faceLabels: NOOP_LABELS },
        legRight: { size: [4, 12, 4], position: [-2, 6, 0], uv: { x: 0, y: 16 }, faceLabels: NOOP_LABELS },
        legLeft: { size: [4, 12, 4], position: [2, 6, 0], uv: { x: 0, y: 16 }, mirrorX: true, faceLabels: NOOP_LABELS },
      },
    };

    const layout = computeMobFrontSpriteLayout(geometry);
    const head = layout.draws.find((d) => d.destWidth === 8 && d.destHeight === 8)!;
    const leg = layout.draws.find((d) => d.destWidth === 4 && d.destHeight === 12)!;

    expect(head.destY).toBeLessThan(leg.destY);
  });

  it('mirrorX se traduce a flipX en el comando de dibujado (la pierna izquierda espejada de la derecha)', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        legRight: { size: [4, 12, 4], position: [-2, 6, 0], uv: { x: 0, y: 16 }, faceLabels: NOOP_LABELS },
        legLeft: { size: [4, 12, 4], position: [2, 6, 0], uv: { x: 0, y: 16 }, mirrorX: true, faceLabels: NOOP_LABELS },
      },
    };

    const layout = computeMobFrontSpriteLayout(geometry);
    const right = layout.draws.find((d) => d.destX < layout.width / 2)!;
    const left = layout.draws.find((d) => d.destX >= layout.width / 2)!;

    expect(right.flipX).toBe(false);
    expect(left.flipX).toBe(true);
    // Ambas leen EXACTAMENTE el mismo rect de origen (mismo `uv`) -- el
    // layout 64x32 clasico no tiene una region UV propia para el lado
    // izquierdo, ver `applyBoxUV.ts`.
    expect(left.src).toEqual(right.src);
  });

  it('orden de dibujado: de menor a mayor `position[2]` (más lejos de la cámara primero)', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        back: { size: [4, 4, 4], position: [0, 0, -4], uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
        front: { size: [4, 4, 4], position: [0, 0, 4], uv: { x: 8, y: 0 }, faceLabels: NOOP_LABELS },
        middle: { size: [4, 4, 4], position: [0, 0, 0], uv: { x: 16, y: 0 }, faceLabels: NOOP_LABELS },
      },
    };

    const layout = computeMobFrontSpriteLayout(geometry);

    // front.x0 = u + d (d=4 para estas cajas) -- back(uv.x=0)->4, middle(uv.x=16)->20, front(uv.x=8)->12.
    expect(layout.draws.map((d) => d.src.x0)).toEqual([4, 20, 12]); // back(-4), middle(0), front(4)
  });

  it('el rect `front` de origen viene de `computeBoxFaceRects` (mismo cálculo que el visor 3D) -- no una fórmula duplicada', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 32,
      parts: {
        body: { size: [8, 12, 4], position: [0, 0, 0], uv: { x: 16, y: 16 }, faceLabels: NOOP_LABELS },
      },
    };

    const layout = computeMobFrontSpriteLayout(geometry);

    // front = { x0: u+d, y0: v+d, x1: u+d+w, y1: v+d+h } = { x0: 20, y0: 20, x1: 28, y1: 32 }
    expect(layout.draws[0]!.src).toEqual({ x0: 20, y0: 20, x1: 28, y1: 32 });
  });
});
