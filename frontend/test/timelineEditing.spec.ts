// Ticket 090 -- edición manual del timeline y validaciones de nombre/
// advertencias. Ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.

import { describe, expect, it } from 'vitest';
import {
  addKeyframe,
  checkWalkRequiresIdle,
  createEmptyAnimation,
  isRecognizedAnimationName,
  moveKeyframe,
  removeKeyframe,
  updateKeyframeValue,
} from '../src/animation/timelineEditing';

const ROT = { x: 0, y: 0, z: 0 };

describe('isRecognizedAnimationName', () => {
  it('reconoce los 5 nombres del plugin', () => {
    for (const name of ['spawn', 'idle', 'walk', 'attack', 'death']) {
      expect(isRecognizedAnimationName(name)).toBe(true);
    }
  });

  it('rechaza un nombre libre', () => {
    expect(isRecognizedAnimationName('bailar')).toBe(false);
  });
});

describe('addKeyframe / removeKeyframe / moveKeyframe', () => {
  it('agrega un keyframe nuevo, manteniendo el orden por tiempo', () => {
    let anim = createEmptyAnimation('idle', 2, true);
    anim = addKeyframe(anim, 'armRight', { time: 1, rotation: ROT });
    anim = addKeyframe(anim, 'armRight', { time: 0, rotation: ROT });
    expect(anim.bones.armRight!.map((k) => k.time)).toEqual([0, 1]);
  });

  it('agregar un keyframe en un tiempo ya ocupado lo reemplaza (fusiona), no duplica', () => {
    let anim = createEmptyAnimation('idle', 2, true);
    anim = addKeyframe(anim, 'head', { time: 1, rotation: ROT });
    anim = addKeyframe(anim, 'head', { time: 1, rotation: { x: 99, y: 0, z: 0 } });
    expect(anim.bones.head).toHaveLength(1);
    expect(anim.bones.head![0]!.rotation.x).toBe(99);
  });

  it('mueve un keyframe existente a otro tiempo', () => {
    let anim = createEmptyAnimation('idle', 2, true);
    anim = addKeyframe(anim, 'head', { time: 0.5, rotation: { x: 7, y: 0, z: 0 } });
    anim = moveKeyframe(anim, 'head', 0.5, 1.5);
    expect(anim.bones.head).toEqual([{ time: 1.5, rotation: { x: 7, y: 0, z: 0 } }]);
  });

  it('mover un keyframe que no existe es un no-op seguro', () => {
    const anim = createEmptyAnimation('idle', 2, true);
    expect(moveKeyframe(anim, 'head', 0.5, 1.5)).toBe(anim);
  });

  it('elimina un keyframe -- el hueso desaparece de "bones" si se queda sin ninguno', () => {
    let anim = createEmptyAnimation('idle', 2, true);
    anim = addKeyframe(anim, 'head', { time: 0, rotation: ROT });
    anim = removeKeyframe(anim, 'head', 0);
    expect(anim.bones.head).toBeUndefined();
  });

  it('eliminar un keyframe inexistente es un no-op seguro', () => {
    const anim = createEmptyAnimation('idle', 2, true);
    expect(removeKeyframe(anim, 'head', 0)).toBe(anim);
  });
});

describe('updateKeyframeValue', () => {
  it('actualiza solo el keyframe indicado, sin mover su tiempo', () => {
    let anim = createEmptyAnimation('idle', 2, true);
    anim = addKeyframe(anim, 'head', { time: 0, rotation: ROT });
    anim = addKeyframe(anim, 'head', { time: 1, rotation: ROT });
    anim = updateKeyframeValue(anim, 'head', 1, { rotation: { x: 15, y: 0, z: 0 } });
    expect(anim.bones.head).toEqual([
      { time: 0, rotation: ROT },
      { time: 1, rotation: { x: 15, y: 0, z: 0 } },
    ]);
  });
});

describe('checkWalkRequiresIdle', () => {
  it('advierte cuando hay "walk" sin "idle"', () => {
    expect(checkWalkRequiresIdle([{ name: 'walk' }])).toMatch(/idle/);
  });

  it('no advierte si ambas existen', () => {
    expect(checkWalkRequiresIdle([{ name: 'walk' }, { name: 'idle' }])).toBeNull();
  });

  it('no advierte sin "walk"', () => {
    expect(checkWalkRequiresIdle([{ name: 'attack' }])).toBeNull();
  });
});
