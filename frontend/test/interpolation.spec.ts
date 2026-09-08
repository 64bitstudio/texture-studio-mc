// Ticket 090 -- muestreo/interpolación de animaciones. Ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.

import { describe, expect, it } from 'vitest';
import { resolveLoopedTime, sampleAnimationAtTime, sampleBoneAtTime } from '../src/animation/interpolation';
import type { AnimationKeyframe, MobAnimation } from '../src/projectStorage';

describe('sampleBoneAtTime', () => {
  it('devuelve null sin keyframes', () => {
    expect(sampleBoneAtTime([], 0.5)).toBeNull();
  });

  it('con un solo keyframe, sostiene su valor en cualquier tiempo', () => {
    const kf: AnimationKeyframe = { time: 1, rotation: { x: 10, y: 0, z: 0 } };
    expect(sampleBoneAtTime([kf], 0)).toEqual({ rotation: { x: 10, y: 0, z: 0 }, position: undefined, scale: undefined });
    expect(sampleBoneAtTime([kf], 99)).toEqual({ rotation: { x: 10, y: 0, z: 0 }, position: undefined, scale: undefined });
  });

  it('antes del primer keyframe, sostiene el primero (sin extrapolar)', () => {
    const kfs: AnimationKeyframe[] = [
      { time: 1, rotation: { x: 10, y: 0, z: 0 } },
      { time: 2, rotation: { x: 20, y: 0, z: 0 } },
    ];
    expect(sampleBoneAtTime(kfs, 0)).toMatchObject({ rotation: { x: 10, y: 0, z: 0 } });
  });

  it('despues del ultimo keyframe, sostiene el ultimo', () => {
    const kfs: AnimationKeyframe[] = [
      { time: 1, rotation: { x: 10, y: 0, z: 0 } },
      { time: 2, rotation: { x: 20, y: 0, z: 0 } },
    ];
    expect(sampleBoneAtTime(kfs, 5)).toMatchObject({ rotation: { x: 20, y: 0, z: 0 } });
  });

  it('interpola linealmente a mitad de camino entre dos keyframes', () => {
    const kfs: AnimationKeyframe[] = [
      { time: 0, rotation: { x: 0, y: 0, z: 0 } },
      { time: 2, rotation: { x: 20, y: 40, z: -10 } },
    ];
    expect(sampleBoneAtTime(kfs, 1)).toMatchObject({ rotation: { x: 10, y: 20, z: -5 } });
  });

  it('interpola position/scale SOLO cuando ambos keyframes vecinos los traen', () => {
    const kfs: AnimationKeyframe[] = [
      { time: 0, rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } },
      { time: 2, rotation: { x: 0, y: 0, z: 0 } }, // sin position
    ];
    const pose = sampleBoneAtTime(kfs, 1);
    expect(pose?.position).toBeUndefined();
  });
});

describe('resolveLoopedTime', () => {
  it('con loop, envuelve el tiempo dentro de [0, length)', () => {
    expect(resolveLoopedTime({ length: 2, loop: true }, 2.5)).toBeCloseTo(0.5);
    expect(resolveLoopedTime({ length: 2, loop: true }, -0.5)).toBeCloseTo(1.5);
  });

  it('sin loop, sostiene (clamp) en vez de envolver', () => {
    expect(resolveLoopedTime({ length: 2, loop: false }, 5)).toBe(2);
    expect(resolveLoopedTime({ length: 2, loop: false }, -1)).toBe(0);
  });
});

describe('sampleAnimationAtTime', () => {
  it('muestrea todos los huesos animados a la vez', () => {
    const animation: MobAnimation = {
      name: 'idle',
      loop: true,
      length: 2,
      bones: {
        armRight: [
          { time: 0, rotation: { x: 0, y: 0, z: 0 } },
          { time: 2, rotation: { x: 10, y: 0, z: 0 } },
        ],
        head: [{ time: 0, rotation: { x: 0, y: 5, z: 0 } }],
      },
    };
    const overrides = sampleAnimationAtTime(animation, 1);
    expect(overrides.armRight?.rotation.x).toBeCloseTo(5);
    expect(overrides.head?.rotation.y).toBe(5);
  });

  it('un hueso sin keyframes no aparece en el resultado', () => {
    const animation: MobAnimation = { name: 'idle', loop: true, length: 1, bones: {} };
    expect(sampleAnimationAtTime(animation, 0)).toEqual({});
  });
});
