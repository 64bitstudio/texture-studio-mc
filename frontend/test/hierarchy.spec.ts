// Ticket 084 -- jerarquia de huesos (padre-hijo). Ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.

import { describe, expect, it } from 'vitest';
import {
  applyDefaultHierarchy,
  computeAbsolutePosition,
  getDefaultParentMap,
  getDescendants,
  setParent,
  wouldCreateCycle,
} from '../src/geometry/hierarchy';
import type { FaceLabels, MobGeometry } from '../src/types/baseAssets';

const NOOP_LABELS: FaceLabels = { front: '', back: '', top: '', bottom: '', left: '', right: '' };

const BIPED_GEOMETRY: MobGeometry = {
  textureWidth: 64,
  textureHeight: 32,
  parts: {
    body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 16, y: 16 }, faceLabels: NOOP_LABELS },
    head: { size: [8, 8, 8], position: [0, 28, 0], uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
    armRight: { size: [2, 12, 2], position: [-5, 18, 0], uv: { x: 40, y: 16 }, faceLabels: NOOP_LABELS },
  },
};

describe('computeAbsolutePosition', () => {
  it('una caja sin parentId ya es absoluta (sin cambios)', () => {
    expect(computeAbsolutePosition(BIPED_GEOMETRY, 'body')).toEqual([0, 18, 0]);
  });

  it('una caja con parentId suma la posicion (relativa) de su padre', () => {
    const result = setParent(BIPED_GEOMETRY, 'head', 'body');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // head absoluta original = [0,28,0], body = [0,18,0] -> relativa a body = [0,10,0]
    expect(result.geometry.parts.head!.position).toEqual([0, 10, 0]);
    // Y la absoluta calculada debe volver a dar el valor original -- la caja no "salto".
    expect(computeAbsolutePosition(result.geometry, 'head')).toEqual([0, 28, 0]);
  });

  it('resuelve una cadena de 2 niveles (abuelo -> padre -> hijo)', () => {
    const step1 = setParent(BIPED_GEOMETRY, 'armRight', 'body');
    expect(step1.ok).toBe(true);
    if (!step1.ok) return;
    const step2 = setParent(step1.geometry, 'head', 'armRight');
    expect(step2.ok).toBe(true);
    if (!step2.ok) return;
    // head sigue en su posicion absoluta original a pesar de la cadena de 2 niveles.
    expect(computeAbsolutePosition(step2.geometry, 'head')).toEqual([0, 28, 0]);
  });
});

describe('getDescendants / wouldCreateCycle', () => {
  it('devuelve todas las descendientes (hijas y nietas)', () => {
    const step1 = setParent(BIPED_GEOMETRY, 'armRight', 'body');
    if (!step1.ok) throw new Error('setParent fallo');
    const step2 = setParent(step1.geometry, 'head', 'armRight');
    if (!step2.ok) throw new Error('setParent fallo');

    expect(getDescendants(step2.geometry, 'body')).toEqual(new Set(['armRight', 'head']));
  });

  it('rechaza asignarse a si misma como padre', () => {
    expect(wouldCreateCycle(BIPED_GEOMETRY, 'body', 'body')).toBe(true);
  });

  it('rechaza asignar como padre a una de sus propias descendientes', () => {
    const step1 = setParent(BIPED_GEOMETRY, 'head', 'body');
    if (!step1.ok) throw new Error('setParent fallo');
    expect(wouldCreateCycle(step1.geometry, 'body', 'head')).toBe(true);
  });

  it('no reporta ciclo entre cajas no relacionadas', () => {
    expect(wouldCreateCycle(BIPED_GEOMETRY, 'head', 'armRight')).toBe(false);
  });
});

describe('setParent', () => {
  it('rechaza con un mensaje claro un ciclo real (HU-3, ultimo criterio de aceptacion)', () => {
    const step1 = setParent(BIPED_GEOMETRY, 'head', 'body');
    if (!step1.ok) throw new Error('setParent fallo');

    const result = setParent(step1.geometry, 'body', 'head');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/ciclo/);
  });

  it('rechaza asignar como padre una caja que no existe', () => {
    const result = setParent(BIPED_GEOMETRY, 'head', 'no-existe');
    expect(result.ok).toBe(false);
  });

  it('rechaza sobre una caja que no existe', () => {
    const result = setParent(BIPED_GEOMETRY, 'no-existe', 'body');
    expect(result.ok).toBe(false);
  });

  it('parentId: null quita el padre y reconvierte la posicion a absoluta', () => {
    const step1 = setParent(BIPED_GEOMETRY, 'head', 'body');
    if (!step1.ok) throw new Error('setParent fallo');

    const step2 = setParent(step1.geometry, 'head', null);
    expect(step2.ok).toBe(true);
    if (!step2.ok) return;
    expect(step2.geometry.parts.head!.parentId).toBeUndefined();
    expect(step2.geometry.parts.head!.position).toEqual([0, 28, 0]);
  });
});

describe('getDefaultParentMap / applyDefaultHierarchy', () => {
  it('devuelve el mapa correcto para cada uno de los 4 mobs vainilla', () => {
    expect(getDefaultParentMap('skeleton')).toEqual({ head: 'body', armRight: 'body', armLeft: 'body', legRight: 'body', legLeft: 'body' });
    expect(getDefaultParentMap('creeper')).toEqual({
      head: 'body',
      legFrontRight: 'body',
      legFrontLeft: 'body',
      legBackRight: 'body',
      legBackLeft: 'body',
    });
  });

  it('devuelve un mapa vacio para un mobId desconocido, sin lanzar', () => {
    expect(getDefaultParentMap('mob-inventado')).toEqual({});
  });

  it('aplica la jerarquia por defecto sin que ninguna caja cambie de posicion absoluta', () => {
    const withHierarchy = applyDefaultHierarchy(BIPED_GEOMETRY, 'skeleton');

    expect(withHierarchy.parts.head!.parentId).toBe('body');
    expect(withHierarchy.parts.armRight!.parentId).toBe('body');
    expect(withHierarchy.parts.body!.parentId).toBeUndefined();

    // Ninguna caja "salto" -- su posicion absoluta sigue siendo la misma que antes de aplicar la jerarquia.
    for (const name of Object.keys(BIPED_GEOMETRY.parts)) {
      expect(computeAbsolutePosition(withHierarchy, name)).toEqual(BIPED_GEOMETRY.parts[name]!.position);
    }
  });

  it('no lanza si faltan partes del mapa esperado (geometria custom, editada)', () => {
    const partial: MobGeometry = { ...BIPED_GEOMETRY, parts: { body: BIPED_GEOMETRY.parts.body! } };
    expect(() => applyDefaultHierarchy(partial, 'skeleton')).not.toThrow();
  });
});
