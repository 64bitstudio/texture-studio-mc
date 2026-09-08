// Ticket 090 -- presets paramétricos de animación. Ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.

import { describe, expect, it } from 'vitest';
import { generatePresetAnimation, getMissingBonesForPreset, getPresetRoleBones } from '../src/animation/presets';
import type { FaceLabels, MobGeometry } from '../src/types/baseAssets';

const LABELS: FaceLabels = { front: 'F', back: 'B', top: 'T', bottom: 'Bo', left: 'L', right: 'R' };

function box(position: [number, number, number] = [0, 0, 0]): MobGeometry['parts'][string] {
  return { size: [4, 4, 4], position, uv: { x: 0, y: 0 }, faceLabels: LABELS };
}

const BIPED_GEOMETRY: MobGeometry = {
  textureWidth: 64,
  textureHeight: 64,
  parts: {
    body: box(),
    head: box(),
    armRight: box(),
    armLeft: box(),
    legRight: box(),
    legLeft: box(),
  },
};

const CREEPER_GEOMETRY: MobGeometry = {
  textureWidth: 64,
  textureHeight: 32,
  parts: {
    body: box(),
    head: box(),
    legFrontRight: box(),
    legFrontLeft: box(),
    legBackRight: box(),
    legBackLeft: box(),
  },
};

describe('getPresetRoleBones', () => {
  it('conoce los 4 mobs vainilla', () => {
    expect(getPresetRoleBones('zombie')?.arms).toEqual(['armRight', 'armLeft']);
    expect(getPresetRoleBones('creeper')?.arms).toBeUndefined();
    expect(getPresetRoleBones('spider')?.legs).toHaveLength(8);
  });

  it('un mobId desconocido no lanza -- devuelve undefined', () => {
    expect(getPresetRoleBones('mob-inventado')).toBeUndefined();
  });
});

describe('getMissingBonesForPreset', () => {
  const zombieRole = getPresetRoleBones('zombie')!;
  const creeperRole = getPresetRoleBones('creeper')!;

  it('walk sobre un biped completo no reporta huesos faltantes', () => {
    expect(getMissingBonesForPreset('walk', zombieRole, BIPED_GEOMETRY)).toEqual([]);
  });

  it('walk sobre una geometria a la que le faltan AMBAS piernas reporta el problema', () => {
    const { legRight, legLeft, ...rest } = BIPED_GEOMETRY.parts;
    void legRight;
    void legLeft;
    const geometry: MobGeometry = { ...BIPED_GEOMETRY, parts: rest };
    const missing = getMissingBonesForPreset('walk', zombieRole, geometry);
    expect(missing).toEqual(expect.arrayContaining(['legRight', 'legLeft']));
  });

  it('walk sobre el Creeper (sin brazos) SI es valido -- usa sus 4 patas propias', () => {
    expect(getMissingBonesForPreset('walk', creeperRole, CREEPER_GEOMETRY)).toEqual([]);
  });

  it('idle/attack sobre un mob sin brazos pero con cabeza siguen siendo validos', () => {
    expect(getMissingBonesForPreset('idle', creeperRole, CREEPER_GEOMETRY)).toEqual([]);
    expect(getMissingBonesForPreset('attack', creeperRole, CREEPER_GEOMETRY)).toEqual([]);
  });

  it('spawn/death necesitan el hueso raiz declarado', () => {
    expect(getMissingBonesForPreset('spawn', zombieRole, BIPED_GEOMETRY)).toEqual([]);
    const { body, ...rest } = BIPED_GEOMETRY.parts;
    void body;
    const geometry: MobGeometry = { ...BIPED_GEOMETRY, parts: rest };
    expect(getMissingBonesForPreset('death', zombieRole, geometry)).toEqual(['body']);
  });
});

describe('generatePresetAnimation', () => {
  it('genera "idle" con arms+head para un biped completo, en loop', () => {
    const result = generatePresetAnimation('idle', 'zombie', BIPED_GEOMETRY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.animation.name).toBe('idle');
    expect(result.animation.loop).toBe(true);
    expect(Object.keys(result.animation.bones)).toEqual(expect.arrayContaining(['armRight', 'armLeft', 'head']));
  });

  it('genera "walk" con piernas en contra-fase', () => {
    const result = generatePresetAnimation('walk', 'zombie', BIPED_GEOMETRY, { speed: 1, amplitude: 30 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const right = result.animation.bones.legRight!;
    const left = result.animation.bones.legLeft!;
    // A t=0 ambas fases dan sin(0)=0 (cruce por cero, sin signo util) --
    // se compara a un cuarto de ciclo, donde fase 0 vs PI da +amplitud
    // vs -amplitud, con signo contrario garantizado.
    const quarterCycleIndex = 2;
    expect(Math.sign(right[quarterCycleIndex]!.rotation.x)).not.toBe(Math.sign(left[quarterCycleIndex]!.rotation.x));
  });

  it('walk cierra el loop -- el primer y ultimo keyframe de cada hueso son iguales', () => {
    const result = generatePresetAnimation('walk', 'zombie', BIPED_GEOMETRY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kfs = result.animation.bones.legRight!;
    const first = kfs[0]!.rotation;
    const last = kfs[kfs.length - 1]!.rotation;
    expect(last.x).toBeCloseTo(first.x);
    expect(last.y).toBeCloseTo(first.y);
    expect(last.z).toBeCloseTo(first.z);
  });

  it('genera "spawn" animando position del hueso raiz, sin loop', () => {
    const result = generatePresetAnimation('spawn', 'zombie', BIPED_GEOMETRY, { speed: 1, amplitude: 5 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.animation.loop).toBe(false);
    expect(result.animation.bones.body![0]!.position).toEqual({ x: 0, y: -5, z: 0 });
    expect(result.animation.bones.body![1]!.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('genera "death" terminando en una pose distinta de la inicial (no vuelve a 0)', () => {
    const result = generatePresetAnimation('death', 'zombie', BIPED_GEOMETRY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kfs = result.animation.bones.body!;
    expect(kfs[0]!.rotation).not.toEqual(kfs[kfs.length - 1]!.rotation);
  });

  it('devuelve missingBones sin generar nada cuando el preset no puede aplicarse', () => {
    const { legRight, legLeft, ...rest } = BIPED_GEOMETRY.parts;
    void legRight;
    void legLeft;
    const geometry: MobGeometry = { ...BIPED_GEOMETRY, parts: rest };
    const result = generatePresetAnimation('walk', 'zombie', geometry);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missingBones.length).toBeGreaterThan(0);
  });

  it('un mobId desconocido no lanza (usa la primera caja como raiz de respaldo)', () => {
    const result = generatePresetAnimation('spawn', 'mob-inventado', BIPED_GEOMETRY);
    expect(result.ok).toBe(true);
  });
});
