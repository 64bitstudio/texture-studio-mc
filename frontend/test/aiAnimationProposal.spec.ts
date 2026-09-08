// Ticket 091 -- asistencia de IA para animación (HU-11/HU-12). Ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.

import { describe, expect, it } from 'vitest';
import {
  buildFreeAnimationPrompt,
  buildPresetParamsPrompt,
  validateAndClampPresetParams,
  validateFreeAnimationProposal,
} from '../src/animation/aiAnimationProposal';
import { PRESET_PARAMS_RANGE } from '../src/animation/presets';
import type { FaceLabels, MobGeometry } from '../src/types/baseAssets';

const LABELS: FaceLabels = { front: '', back: '', top: '', bottom: '', left: '', right: '' };

const GEOMETRY: MobGeometry = {
  textureWidth: 64,
  textureHeight: 64,
  parts: {
    body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 0, y: 0 }, faceLabels: LABELS },
    head: { size: [8, 8, 8], position: [0, 10, 0], parentId: 'body', uv: { x: 0, y: 0 }, faceLabels: LABELS },
    armRight: { size: [4, 12, 4], position: [-6, 8, 0], parentId: 'body', uv: { x: 0, y: 0 }, faceLabels: LABELS },
  },
};

describe('buildPresetParamsPrompt', () => {
  it('incluye el nombre del preset, la descripcion y los rangos validos', () => {
    const prompt = buildPresetParamsPrompt('walk', 'caminar arrastrando los pies');
    expect(prompt).toContain('walk');
    expect(prompt).toContain('caminar arrastrando los pies');
    expect(prompt).toContain('speed');
    expect(prompt).toContain('amplitude');
  });
});

describe('validateAndClampPresetParams', () => {
  it('acepta parametros dentro de rango tal cual', () => {
    const result = validateAndClampPresetParams({ speed: 1.5, amplitude: 30 });
    expect(result).toEqual({ ok: true, params: { speed: 1.5, amplitude: 30 } });
  });

  it('recorta (no rechaza) parametros fuera de rango', () => {
    const result = validateAndClampPresetParams({ speed: 999, amplitude: -10 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params.speed).toBe(PRESET_PARAMS_RANGE.speed.max);
    expect(result.params.amplitude).toBe(PRESET_PARAMS_RANGE.amplitude.min);
  });

  it('rechaza una respuesta sin la forma esperada', () => {
    expect(validateAndClampPresetParams('no es un objeto').ok).toBe(false);
    expect(validateAndClampPresetParams({ speed: 'rapido', amplitude: 20 }).ok).toBe(false);
    expect(validateAndClampPresetParams({ speed: 1, amplitude: 'mucho' }).ok).toBe(false);
  });
});

describe('buildFreeAnimationPrompt', () => {
  it('incluye la descripcion y los huesos disponibles', () => {
    const prompt = buildFreeAnimationPrompt(GEOMETRY, 'un salto exagerado hacia adelante');
    expect(prompt).toContain('un salto exagerado hacia adelante');
    expect(prompt).toContain('armRight');
    expect(prompt).toContain('spawn');
  });
});

describe('validateFreeAnimationProposal -- rechazos', () => {
  it('rechaza una respuesta que no es un objeto', () => {
    expect(validateFreeAnimationProposal('no es json', GEOMETRY).ok).toBe(false);
  });

  it('rechaza sin "name"/"loop"/"length" validos', () => {
    expect(validateFreeAnimationProposal({ loop: true, length: 1, bones: {} }, GEOMETRY).ok).toBe(false);
    expect(validateFreeAnimationProposal({ name: 'x', length: 1, bones: {} }, GEOMETRY).ok).toBe(false);
    expect(validateFreeAnimationProposal({ name: 'x', loop: true, bones: {} }, GEOMETRY).ok).toBe(false);
  });

  it('rechaza "bones" vacio', () => {
    expect(validateFreeAnimationProposal({ name: 'x', loop: false, length: 1, bones: {} }, GEOMETRY).ok).toBe(false);
  });

  it('rechaza un hueso que no existe en la geometria', () => {
    const result = validateFreeAnimationProposal(
      { name: 'x', loop: false, length: 1, bones: { fantasma: [{ time: 0, rotation: { x: 0, y: 0, z: 0 } }] } },
      GEOMETRY,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/fantasma/);
  });

  it('rechaza un keyframe con time fuera de [0, length]', () => {
    const result = validateFreeAnimationProposal(
      { name: 'x', loop: false, length: 1, bones: { head: [{ time: 5, rotation: { x: 0, y: 0, z: 0 } }] } },
      GEOMETRY,
    );
    expect(result.ok).toBe(false);
  });

  it('rechaza una rotation invalida', () => {
    const result = validateFreeAnimationProposal(
      { name: 'x', loop: false, length: 1, bones: { head: [{ time: 0, rotation: { x: 0, y: 0 } }] } },
      GEOMETRY,
    );
    expect(result.ok).toBe(false);
  });
});

describe('validateFreeAnimationProposal -- aceptacion y coherencia', () => {
  it('aplica una propuesta valida sin advertencias cuando es coherente', () => {
    const result = validateFreeAnimationProposal(
      {
        name: 'saludo',
        loop: false,
        length: 1,
        bones: {
          armRight: [
            { time: 0, rotation: { x: 0, y: 0, z: 0 } },
            { time: 1, rotation: { x: -30, y: 0, z: 0 } },
          ],
        },
      },
      GEOMETRY,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.animation.name).toBe('saludo');
    expect(result.warnings).toEqual([]);
  });

  it('marca un salto brusco de rotacion como advertencia, sin rechazar la propuesta', () => {
    const result = validateFreeAnimationProposal(
      {
        name: 'saludo',
        loop: false,
        length: 1,
        bones: {
          armRight: [
            { time: 0, rotation: { x: 0, y: 0, z: 0 } },
            { time: 0.05, rotation: { x: 170, y: 0, z: 0 } }, // ~3400 grados/seg -- muy por encima del umbral.
          ],
        },
      },
      GEOMETRY,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.boneName).toBe('armRight');
    expect(result.warnings[0]!.reason).toMatch(/brusco/);
  });

  it('un swing rapido pero PEDIDO A PROPOSITO (velocidad moderada) no genera advertencia -- el umbral escala con la duracion', () => {
    const result = validateFreeAnimationProposal(
      {
        name: 'trote',
        loop: true,
        length: 0.3,
        bones: {
          armRight: [
            { time: 0, rotation: { x: 0, y: 0, z: 0 } },
            { time: 0.15, rotation: { x: 40, y: 0, z: 0 } },
            { time: 0.3, rotation: { x: 0, y: 0, z: 0 } },
          ],
        },
      },
      GEOMETRY,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });

  it('marca un cierre de loop incompatible como advertencia', () => {
    const result = validateFreeAnimationProposal(
      {
        name: 'walk',
        loop: true,
        length: 1,
        bones: {
          armRight: [
            { time: 0, rotation: { x: 0, y: 0, z: 0 } },
            { time: 1, rotation: { x: 40, y: 0, z: 0 } },
          ],
        },
      },
      GEOMETRY,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((w) => w.reason.includes('no coinciden'))).toBe(true);
  });

  it('ordena los keyframes por tiempo aunque lleguen desordenados', () => {
    const result = validateFreeAnimationProposal(
      {
        name: 'x',
        loop: false,
        length: 1,
        bones: {
          head: [
            { time: 1, rotation: { x: 10, y: 0, z: 0 } },
            { time: 0, rotation: { x: 0, y: 0, z: 0 } },
          ],
        },
      },
      GEOMETRY,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.animation.bones.head!.map((k) => k.time)).toEqual([0, 1]);
  });
});
