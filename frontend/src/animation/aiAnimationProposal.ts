// Ticket 091 -- asistencia de IA para animación (Etapa 4, HU-11/HU-12).
// Ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md y el
// spike `done/081-spike-calidad-ia-animacion.md` (evidencia real que
// sostiene construir ambas HUs en esta versión, y los 2 hallazgos de
// diseño incorporados abajo: reintentos con backoff ya viven en el
// endpoint del ticket 087 -- nada que hacer aquí -- y el umbral de
// "salto máximo" debe escalar con la duración de la animación, no ser
// una constante fija).
//
// Deliberadamente puro -- sin React/fetch -- mismo criterio de
// testabilidad que `geometryProposal.ts`/`colorProposal.ts` (tickets
// 088/089), ver `frontend/test/aiAnimationProposal.spec.ts`.

import { clampPresetParams, type PresetParams } from './presets';
import { RECOGNIZED_ANIMATION_NAMES, type RecognizedAnimationName } from './timelineEditing';
import type { AnimationKeyframe, MobAnimation } from '../projectStorage';
import type { MobGeometry } from '../types/baseAssets';

// ---------------------------------------------------------------------
// HU-11 -- la IA ajusta los PARÁMETROS de un preset (nunca keyframes
// libres), a partir de una descripción de estilo (ej. "caminar
// arrastrando los pies"). Reusa el MISMO `generatePresetAnimation`
// (ticket 090) que ya usan los sliders manuales -- una vez que
// `clampPresetParams` devuelve un `PresetParams` válido, ajustarlo a
// mano después es indistinguible de haberlo escrito desde el inicio
// (mismo estado, mismo componente `AnimationEditor.tsx`).
// ---------------------------------------------------------------------

export function buildPresetParamsPrompt(preset: RecognizedAnimationName, description: string): string {
  return `Vas a ajustar los parámetros de un preset de animación "${preset}" para un mob de Minecraft, según esta descripción de estilo: "${description}"

Los parámetros son:
- "speed": velocidad del ciclo (numero, rango válido ${JSON.stringify([0.25, 3])}) -- mayor = más rápido.
- "amplitude": amplitud del movimiento en grados (numero, rango válido ${JSON.stringify([5, 60])}) -- mayor = swing más exagerado.

Responde SOLO con JSON valido en este formato exacto (sin texto extra):
{
  "speed": <numero>,
  "amplitude": <numero>
}`;
}

export type PresetParamsProposalResult = { ok: true; params: PresetParams } | { ok: false; error: string };

/**
 * Valida la respuesta cruda de la IA para HU-11 -- a diferencia de
 * `validateAndApplyGeometryProposal`/`validateAndApplyColorProposal`
 * (tickets 088/089), un valor fuera de rango NO se rechaza: se recorta
 * con `clampPresetParams` (criterio explícito del ticket: "sin error
 * visible"). Solo se rechaza si la respuesta ni siquiera tiene la
 * forma esperada (no son los 2 números).
 */
export function validateAndClampPresetParams(raw: unknown): PresetParamsProposalResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'La respuesta no tiene la forma esperada: se esperaba un objeto con "speed" y "amplitude".' };
  }
  const { speed, amplitude } = raw as Record<string, unknown>;
  if (typeof speed !== 'number' || !Number.isFinite(speed)) {
    return { ok: false, error: 'La respuesta no incluye un "speed" numérico válido.' };
  }
  if (typeof amplitude !== 'number' || !Number.isFinite(amplitude)) {
    return { ok: false, error: 'La respuesta no incluye una "amplitude" numérica válida.' };
  }
  return { ok: true, params: clampPresetParams({ speed, amplitude }) };
}

// ---------------------------------------------------------------------
// HU-12 -- animación libre (keyframes completos, cualquier hueso,
// experimental). La propuesta se valida a fondo (esquema) y ADEMÁS se
// revisa por coherencia (no bloqueante, solo advertencias visuales):
// saltos angulares bruscos entre keyframes consecutivos, y cierre de
// loop incompatible.
// ---------------------------------------------------------------------

export function buildFreeAnimationPrompt(geometry: MobGeometry, description: string): string {
  const boneNames = Object.keys(geometry.parts);
  return `Vas a proponer una animación completa y libre para un mob de Minecraft con esta jerarquía de huesos disponible: ${JSON.stringify(boneNames)}

Descripción de la animación pedida: "${description}"

Puedes usar cualquiera de estos 5 nombres si la animación calza con uno (${RECOGNIZED_ANIMATION_NAMES.join('/')}, se disparan automáticamente en el juego) o un nombre libre (se guarda igual, pero solo se dispara manualmente por código del servidor).

Responde SOLO con JSON valido en este formato exacto (sin texto extra) -- anima solo los huesos relevantes, no hace falta cubrir todos; cada keyframe de rotación es en GRADOS, relativo a la pose de reposo del hueso (0,0,0 = pose de reposo, no una rotación absoluta):
{
  "name": "<nombre_de_la_animacion>",
  "loop": <true_o_false>,
  "length": <duracion_en_segundos>,
  "bones": {
    "<nombre_de_hueso_de_la_lista_de_arriba>": [
      { "time": <segundos_entre_0_y_length>, "rotation": { "x": <grados>, "y": <grados>, "z": <grados> } }
    ]
  }
}

Si "loop" es true, el primer y el ultimo keyframe de cada hueso deben tener valores iguales o muy parecidos (para que la animacion cicle sin saltos).`;
}

export interface FreeAnimationWarning {
  boneName: string;
  /** Momento (segundos) del keyframe donde se detectó el problema -- el keyframe DE LLEGADA para un salto brusco, o el último keyframe para un cierre de loop incompatible. */
  time: number;
  reason: string;
}

export type FreeAnimationProposalResult = { ok: true; animation: MobAnimation; warnings: FreeAnimationWarning[] } | { ok: false; error: string };

/**
 * Velocidad angular máxima "razonable" entre dos keyframes consecutivos
 * -- 720°/s (2 vueltas completas por segundo). Deliberadamente
 * generoso: un swing rápido/rígido PEDIDO A PROPÓSITO (trote, estilo
 * robótico) no debe marcarse como sospechoso (hallazgo del spike 081,
 * punto 3) -- este umbral solo atrapa saltos genuinamente imposibles
 * (ej. un typo de la IA poniendo 180° donde quería 18°).
 *
 * Es una velocidad (°/s), no un salto fijo en grados -- por diseño ya
 * "escala con la duración/velocidad de la animación" (hallazgo del
 * spike 081): el mismo salto de 90° en 0.05s (1800°/s) se marca, pero
 * en 0.5s (180°/s) no.
 */
const MAX_ANGULAR_SPEED_DEG_PER_SEC = 720;

/** Tolerancia para considerar que el primer y el último keyframe de un hueso en loop "cierran" -- por debajo de esto, la diferencia se atribuye a redondeo, no a una animación mal cerrada. */
const LOOP_CLOSURE_TOLERANCE_DEG = 5;

function rotationDistanceDeg(a: AnimationKeyframe['rotation'], b: AnimationKeyframe['rotation']): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

function findCoherenceWarnings(boneName: string, keyframes: AnimationKeyframe[], loop: boolean): FreeAnimationWarning[] {
  const warnings: FreeAnimationWarning[] = [];

  for (let i = 1; i < keyframes.length; i++) {
    const from = keyframes[i - 1]!;
    const to = keyframes[i]!;
    const dt = to.time - from.time;
    if (dt <= 0) continue; // keyframes en el mismo instante (o desordenados, no deberia pasar tras el sort) -- nada que medir como "velocidad".
    const speed = rotationDistanceDeg(from.rotation, to.rotation) / dt;
    if (speed > MAX_ANGULAR_SPEED_DEG_PER_SEC) {
      warnings.push({ boneName, time: to.time, reason: `Salto brusco de rotación (~${Math.round(speed)}°/s) respecto al keyframe anterior.` });
    }
  }

  if (loop && keyframes.length >= 2) {
    const first = keyframes[0]!;
    const last = keyframes[keyframes.length - 1]!;
    if (rotationDistanceDeg(first.rotation, last.rotation) > LOOP_CLOSURE_TOLERANCE_DEG) {
      warnings.push({ boneName, time: last.time, reason: 'El primer y el último keyframe no coinciden -- la animación en loop podría "saltar" al repetirse.' });
    }
  }

  return warnings;
}

function isFiniteVec3(value: unknown): value is { x: number; y: number; z: number } {
  if (typeof value !== 'object' || value === null) return false;
  const { x, y, z } = value as Record<string, unknown>;
  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y) && typeof z === 'number' && Number.isFinite(z);
}

/**
 * Valida la forma cruda de una propuesta de animación libre (HU-12)
 * contra `geometry`, y si es válida, la aplica -- revisando además
 * coherencia (saltos/cierre de loop, `warnings`, NO bloqueante). Un
 * hueso que no existe en `geometry.parts`, o cualquier valor con forma
 * incorrecta, rechaza la propuesta entera (`ok: false`) -- mismo
 * criterio de estrictez ya establecido en `geometryProposal.ts`/
 * `colorProposal.ts`.
 */
export function validateFreeAnimationProposal(raw: unknown, geometry: MobGeometry): FreeAnimationProposalResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'La respuesta no tiene la forma esperada: se esperaba un objeto con "name"/"loop"/"length"/"bones".' };
  }
  const { name, loop, length, bones } = raw as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return { ok: false, error: 'La respuesta no incluye un "name" válido.' };
  }
  if (typeof loop !== 'boolean') {
    return { ok: false, error: 'La respuesta no incluye un "loop" válido (debe ser true o false).' };
  }
  if (typeof length !== 'number' || !Number.isFinite(length) || length <= 0) {
    return { ok: false, error: 'La respuesta no incluye un "length" válido (debe ser un número positivo).' };
  }
  if (typeof bones !== 'object' || bones === null || Array.isArray(bones) || Object.keys(bones).length === 0) {
    return { ok: false, error: '"bones" debe ser un objeto no vacío de huesos.' };
  }

  const finalBones: Record<string, AnimationKeyframe[]> = {};
  const warnings: FreeAnimationWarning[] = [];

  for (const [boneName, rawKeyframes] of Object.entries(bones as Record<string, unknown>)) {
    if (!(boneName in geometry.parts)) {
      return { ok: false, error: `El hueso "${boneName}" no existe en este modelo.` };
    }
    if (!Array.isArray(rawKeyframes) || rawKeyframes.length === 0) {
      return { ok: false, error: `El hueso "${boneName}" debe tener una lista no vacía de keyframes.` };
    }

    const keyframes: AnimationKeyframe[] = [];
    for (const rawKeyframe of rawKeyframes) {
      if (typeof rawKeyframe !== 'object' || rawKeyframe === null) {
        return { ok: false, error: `Un keyframe de "${boneName}" no es un objeto válido.` };
      }
      const { time, rotation, position, scale } = rawKeyframe as Record<string, unknown>;
      if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > length) {
        return { ok: false, error: `Un keyframe de "${boneName}" tiene un "time" inválido (debe estar entre 0 y ${length}).` };
      }
      if (!isFiniteVec3(rotation)) {
        return { ok: false, error: `Un keyframe de "${boneName}" tiene una "rotation" inválida (se esperan x/y/z numéricos).` };
      }
      if (position !== undefined && !isFiniteVec3(position)) {
        return { ok: false, error: `Un keyframe de "${boneName}" tiene una "position" inválida (se esperan x/y/z numéricos).` };
      }
      if (scale !== undefined && !isFiniteVec3(scale)) {
        return { ok: false, error: `Un keyframe de "${boneName}" tiene una "scale" inválida (se esperan x/y/z numéricos).` };
      }

      const keyframe: AnimationKeyframe = { time, rotation };
      if (position !== undefined) keyframe.position = position;
      if (scale !== undefined) keyframe.scale = scale;
      keyframes.push(keyframe);
    }

    keyframes.sort((a, b) => a.time - b.time);
    finalBones[boneName] = keyframes;
    warnings.push(...findCoherenceWarnings(boneName, keyframes, loop));
  }

  return { ok: true, animation: { name: name.trim(), loop, length, bones: finalBones }, warnings };
}
