import { describe, expect, it } from 'vitest';
import { computeNamedRegions, findRegionAtPixel, findRegionAt, type NamedUVRegion } from '../src/regionLabels';
import type { SkeletonGeometry } from '../src/types/baseAssets';

// Mismos valores (size/position/uv/mirrorX) Y mismo catalogo de
// `faceLabels` que `backend/src/geometry/skeletonGeometry.ts` (ticket
// 011) -- duplicados aca a proposito, mismo criterio ya establecido por
// `test/symmetry.spec.ts` (sin paquete compartido en este proyecto, ver
// docs/ARQUITECTURA.md).
const HEAD_FACE_LABELS = {
  front: 'Cara',
  back: 'Nuca',
  top: 'Parte superior',
  bottom: 'Parte inferior',
  left: 'Lateral derecho',
  right: 'Lateral izquierdo',
};
const BODY_FACE_LABELS = {
  front: 'Pecho',
  back: 'Espalda',
  top: 'Parte superior',
  bottom: 'Parte inferior',
  left: 'Costado derecho',
  right: 'Costado izquierdo',
};
const ARM_FACE_LABELS = {
  front: 'Brazo — Frente',
  back: 'Brazo — Atrás',
  top: 'Brazo — Superior',
  bottom: 'Brazo — Inferior',
  left: 'Brazo — Lateral',
  right: 'Brazo — Lateral',
};
const LEG_FACE_LABELS = {
  front: 'Pierna — Frente',
  back: 'Pierna — Atrás',
  top: 'Pierna — Superior',
  bottom: 'Pierna — Inferior',
  left: 'Pierna — Lateral',
  right: 'Pierna — Lateral',
};

const SKELETON_GEOMETRY: SkeletonGeometry = {
  textureWidth: 64,
  textureHeight: 32,
  parts: {
    head: { size: [8, 8, 8], position: [0, 28, 0], uv: { x: 0, y: 0 }, faceLabels: HEAD_FACE_LABELS },
    body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 16, y: 16 }, faceLabels: BODY_FACE_LABELS },
    armRight: { size: [2, 12, 2], position: [-5, 18, 0], uv: { x: 40, y: 16 }, faceLabels: ARM_FACE_LABELS },
    armLeft: {
      size: [2, 12, 2],
      position: [5, 18, 0],
      uv: { x: 40, y: 16 },
      mirrorX: true,
      faceLabels: ARM_FACE_LABELS,
    },
    legRight: { size: [2, 12, 2], position: [-2, 6, 0], uv: { x: 0, y: 16 }, faceLabels: LEG_FACE_LABELS },
    legLeft: {
      size: [2, 12, 2],
      position: [2, 6, 0],
      uv: { x: 0, y: 16 },
      mirrorX: true,
      faceLabels: LEG_FACE_LABELS,
    },
  },
};

describe('computeNamedRegions', () => {
  it('produce 6 regiones por cada una de las 4 cajas UV distintas -- 24 regiones, sin duplicar armRight/armLeft ni legRight/legLeft', () => {
    const regions = computeNamedRegions(SKELETON_GEOMETRY);
    // head(6) + body(6) + arm(6, compartida armRight/armLeft) + leg(6, compartida legRight/legLeft) = 24
    expect(regions).toHaveLength(24);
    const ids = regions.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length); // sin ids duplicados

    expect(ids).toContain('head.front');
    expect(ids).toContain('body.left');
    expect(ids).toContain('arm.top');
    expect(ids).toContain('leg.bottom');
    // Nunca se generan regiones separadas "armRight.front"/"armLeft.front".
    expect(ids).not.toContain('armRight.front');
    expect(ids).not.toContain('armLeft.front');
  });

  it('la region "front" de la cabeza es exactamente la caja frontal calculada por computeBoxFaceRects (misma formula que applyBoxUV)', () => {
    const regions = computeNamedRegions(SKELETON_GEOMETRY);
    const headFront = regions.find((r) => r.id === 'head.front')!;
    // head: u=0,v=0,w=8,h=8,d=8 -> front = { x0: u+d, y0: v+d, x1: u+d+w, y1: v+d+h } = (8,8)-(16,16)
    expect(headFront.rect).toEqual({ x0: 8, y0: 8, x1: 16, y1: 16 });
    expect(headFront.label).toBe('Cara');
    expect(headFront.groupKey).toBe('head');
    expect(headFront.face).toBe('front');
  });

  it('escala los rectangulos con `scale` (ticket 009, resolucion x1-x10) -- mismo criterio que computeUVBoxRects', () => {
    const native = computeNamedRegions(SKELETON_GEOMETRY);
    const scaled = computeNamedRegions(SKELETON_GEOMETRY, 4);
    expect(scaled).toHaveLength(native.length);
    const byId = new Map(scaled.map((r) => [r.id, r]));
    for (const region of native) {
      const scaledRegion = byId.get(region.id)!;
      expect(scaledRegion.rect).toEqual({
        x0: region.rect.x0 * 4,
        y0: region.rect.y0 * 4,
        x1: region.rect.x1 * 4,
        y1: region.rect.y1 * 4,
      });
    }
  });

  it('scale=1 (default) es identico a no pasar el parametro', () => {
    expect(computeNamedRegions(SKELETON_GEOMETRY, 1)).toEqual(computeNamedRegions(SKELETON_GEOMETRY));
  });

  it('armRight/armLeft y legRight/legLeft producen labels SIN lateralidad (misma region UV afecta a ambos lados 3D)', () => {
    const regions = computeNamedRegions(SKELETON_GEOMETRY);
    const armFront = regions.find((r) => r.id === 'arm.front')!;
    const legFront = regions.find((r) => r.id === 'leg.front')!;
    expect(armFront.label).not.toMatch(/derech|izquierd/i);
    expect(legFront.label).not.toMatch(/derech|izquierd/i);
  });
});

describe('findRegionAtPixel / findRegionAt', () => {
  const regions = computeNamedRegions(SKELETON_GEOMETRY);

  it('identifica correctamente un pixel en cada zona pedida por el ticket (cabeza, torso, brazo, pierna)', () => {
    expect(findRegionAtPixel(10, 10, regions)?.label).toBe('Cara'); // cabeza, cara frontal
    expect(findRegionAtPixel(20, 20, regions)?.label).toBe('Pecho'); // torso, cara frontal -- rect exacto en el caso dedicado abajo
    expect(findRegionAtPixel(43, 20, regions)?.groupKey).toBe('arm'); // brazo -- rect exacto en el caso dedicado abajo
    expect(findRegionAtPixel(2, 20, regions)?.groupKey).toBe('leg'); // pierna -- rect exacto en el caso dedicado abajo
  });

  it('body.front es el rectangulo esperado (u=16,v=16,w=8,h=12,d=4 -> front=(20,20)-(28,32))', () => {
    const bodyFront = regions.find((r) => r.id === 'body.front')!;
    expect(bodyFront.rect).toEqual({ x0: 20, y0: 20, x1: 28, y1: 32 });
    expect(findRegionAtPixel(24, 25, regions)).toEqual(bodyFront);
  });

  it('arm.front es el rectangulo esperado (u=40,v=16,w=2,h=12,d=2 -> front=(42,18)-(44,30))', () => {
    const armFront = regions.find((r) => r.id === 'arm.front')!;
    expect(armFront.rect).toEqual({ x0: 42, y0: 18, x1: 44, y1: 30 });
    expect(findRegionAtPixel(43, 20, regions)).toEqual(armFront);
  });

  it('leg.front es el rectangulo esperado (u=0,v=16,w=2,h=12,d=2 -> front=(2,18)-(4,30))', () => {
    const legFront = regions.find((r) => r.id === 'leg.front')!;
    expect(legFront.rect).toEqual({ x0: 2, y0: 18, x1: 4, y1: 30 });
    expect(findRegionAtPixel(3, 20, regions)).toEqual(legFront);
  });

  it('devuelve null para un pixel fuera de toda caja UV conocida (zona de relleno del layout 64x32)', () => {
    expect(findRegionAtPixel(60, 20, regions)).toBeNull(); // relleno a la derecha del brazo
    expect(findRegionAtPixel(50, 5, regions)).toBeNull(); // relleno superior derecho
  });

  it('devuelve null para coordenadas fuera de rango (negativas o mas alla del ancho/alto de la textura)', () => {
    expect(findRegionAtPixel(-1, 5, regions)).toBeNull();
    expect(findRegionAtPixel(5, -1, regions)).toBeNull();
    expect(findRegionAtPixel(1000, 1000, regions)).toBeNull();
  });

  it('findRegionAt (azucar sobre PixelPoint) devuelve el mismo resultado que findRegionAtPixel', () => {
    const point = { x: 10, y: 10 };
    const region: NamedUVRegion | null = findRegionAt(point, regions);
    expect(region).toEqual(findRegionAtPixel(point.x, point.y, regions));
    expect(region?.label).toBe('Cara');
  });
});
