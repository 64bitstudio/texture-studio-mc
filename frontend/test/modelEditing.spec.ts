// Ticket 083 -- edicion manual de geometria (agregar/mover/redimensionar/
// rotar/eliminar cajas). Ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NEW_BOX_SIZE,
  addBox,
  canDeleteBox,
  findNonOverlappingPosition,
  generateNewPartName,
  removeBox,
  roundBoxSize,
  updateBoxTransform,
} from '../src/geometry/modelEditing';
import type { FaceLabels, MobGeometry } from '../src/types/baseAssets';

const NOOP_LABELS: FaceLabels = { front: '', back: '', top: '', bottom: '', left: '', right: '' };

const EMPTY_GEOMETRY: MobGeometry = { textureWidth: 64, textureHeight: 64, parts: {} };

const BIPED_GEOMETRY: MobGeometry = {
  textureWidth: 64,
  textureHeight: 32,
  parts: {
    head: { size: [8, 8, 8], position: [0, 28, 0], uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
    body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 16, y: 16 }, faceLabels: NOOP_LABELS },
  },
};

describe('generateNewPartName', () => {
  it('devuelve "caja1" en una geometria sin cajas agregadas a mano', () => {
    expect(generateNewPartName(BIPED_GEOMETRY)).toBe('caja1');
  });

  it('nunca colisiona con un nombre ya existente (vainilla o agregado antes)', () => {
    const geometry: MobGeometry = { ...BIPED_GEOMETRY, parts: { ...BIPED_GEOMETRY.parts, caja1: { ...BIPED_GEOMETRY.parts.head! } } };
    expect(generateNewPartName(geometry)).toBe('caja2');
  });
});

describe('findNonOverlappingPosition', () => {
  it('en una geometria vacia, coloca la caja sobre el piso en el origen', () => {
    expect(findNonOverlappingPosition(EMPTY_GEOMETRY, [4, 4, 4])).toEqual([0, 2, 0]);
  });

  it('con cajas existentes, la coloca al lado (+x) del bounding box combinado, sin superponerse', () => {
    const [x] = findNonOverlappingPosition(BIPED_GEOMETRY, [4, 4, 4]);
    // El bounding box del biped llega hasta x=4 (mitad del ancho de head/body, ambos centrados en x=0 con ancho 8) -- la caja nueva debe quedar mas alla de eso.
    expect(x).toBeGreaterThan(4);
  });
});

describe('addBox / removeBox', () => {
  it('agrega una caja con el tamaño por defecto si no se especifica uno', () => {
    const { geometry, name } = addBox(EMPTY_GEOMETRY);
    expect(name).toBe('caja1');
    expect(geometry.parts.caja1!.size).toEqual(DEFAULT_NEW_BOX_SIZE);
  });

  it('agregar una caja no muta la geometria original (inmutable)', () => {
    const before = JSON.stringify(BIPED_GEOMETRY);
    addBox(BIPED_GEOMETRY, [2, 2, 2]);
    expect(JSON.stringify(BIPED_GEOMETRY)).toBe(before);
  });

  it('elimina una caja existente sin afectar las demas', () => {
    const { geometry } = addBox(BIPED_GEOMETRY, [2, 2, 2]);
    const after = removeBox(geometry, 'caja1');
    expect(after.parts.caja1).toBeUndefined();
    expect(after.parts.head).toEqual(BIPED_GEOMETRY.parts.head);
    expect(after.parts.body).toEqual(BIPED_GEOMETRY.parts.body);
  });

  it('eliminar un nombre que no existe es un no-op seguro', () => {
    expect(removeBox(BIPED_GEOMETRY, 'no-existe')).toEqual(BIPED_GEOMETRY);
  });
});

describe('updateBoxTransform', () => {
  it('actualiza solo la posicion, sin tocar tamaño/rotacion', () => {
    const updated = updateBoxTransform(BIPED_GEOMETRY, 'head', { position: [1, 2, 3] });
    expect(updated.parts.head!.position).toEqual([1, 2, 3]);
    expect(updated.parts.head!.size).toEqual(BIPED_GEOMETRY.parts.head!.size);
  });

  it('actualiza tamaño (modo escalar)', () => {
    const updated = updateBoxTransform(BIPED_GEOMETRY, 'body', { size: [10, 14, 6] });
    expect(updated.parts.body!.size).toEqual([10, 14, 6]);
  });

  it('actualiza rotacion (modo rotar) sin requerir pivot', () => {
    const updated = updateBoxTransform(BIPED_GEOMETRY, 'head', { rotation: [0, 45, 0] });
    expect(updated.parts.head!.rotation).toEqual([0, 45, 0]);
    expect(updated.parts.head!.pivot).toBeUndefined();
  });

  it('sobre un nombre inexistente es un no-op seguro', () => {
    expect(updateBoxTransform(BIPED_GEOMETRY, 'no-existe', { position: [9, 9, 9] })).toEqual(BIPED_GEOMETRY);
  });
});

describe('canDeleteBox', () => {
  it('rechaza eliminar una caja de la geometria vainilla original', () => {
    const original = new Set(['head', 'body']);
    expect(canDeleteBox('head', original)).toBe(false);
  });

  it('permite eliminar una caja agregada durante la edicion', () => {
    const original = new Set(['head', 'body']);
    expect(canDeleteBox('caja1', original)).toBe(true);
  });
});

// Hallazgo real de Marco ("confirmar modelo no hace nada"): ver el
// comentario de `roundBoxSize` en `src/geometry/modelEditing.ts` para la
// causa raiz completa (un tamaño fraccionario rompe el atlas UV al
// confirmar el modelo).
describe('roundBoxSize', () => {
  it('redondea cada componente al entero mas cercano', () => {
    expect(roundBoxSize([8.4, 4.2, 3.5])).toEqual([8, 4, 4]);
  });

  it('un valor menor a 0.5 se redondea a 1, nunca a 0', () => {
    expect(roundBoxSize([0.3, 0.49, 0.1])).toEqual([1, 1, 1]);
  });

  it('un tamaño ya entero queda igual', () => {
    expect(roundBoxSize([4, 8, 2])).toEqual([4, 8, 2]);
  });
});
