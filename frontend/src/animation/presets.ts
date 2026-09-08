// Ticket 090 -- presets paramétricos de animación (Etapa 4, HU-9). Ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.
//
// Deliberadamente puro -- sin React/three.js -- mismo criterio de
// testabilidad que `hierarchy.ts` (ver `frontend/test/presets.spec.ts`).
//
// DECISION DE DISEÑO (no especificada literalmente por el ticket, ver
// docs/ARQUITECTURA.md "Ticket 090" para el detalle completo): cada
// preset necesita saber qué hueso juega qué "rol" anatómico (brazo
// derecho, pierna izquierda, cabeza...) para generar un swing con
// sentido -- pero los 4 mobs vainilla NO comparten los mismos nombres
// de hueso (el Creeper no tiene brazos; la Araña tiene 8 patas con
// nombres propios, sin "legRight"/"legLeft"). Se resuelve con una
// tabla `PRESET_ROLE_BONES` por `mobId`, exactamente análoga a
// `DEFAULT_HIERARCHY` de `hierarchy.ts` (mismo mobId, mismo criterio de
// "tabla estática, `{}`/vacío para un mobId desconocido en vez de
// lanzar"). Para geometría CUSTOM (editada en el editor de modelo,
// tickets 083+), esta tabla es solo el PUNTO DE PARTIDA -- la
// aplicación real de un preset (`generatePresetAnimation`) siempre
// vuelve a comprobar que esos huesos EXISTAN de verdad en la geometría
// actual antes de animarlos (HU-9, criterio 2: "aviso claro de qué
// huesos faltan, sin romper el modelo").

import type { MobGeometry } from '../types/baseAssets';
import type { AnimationKeyframe, MobAnimation } from '../projectStorage';
import type { RecognizedAnimationName } from './timelineEditing';

export interface PresetParams {
  /** Ciclos por segundo (idle/walk) o inverso de la duración (attack/spawn/death) -- mayor = más rápido. */
  speed: number;
  /** Amplitud del swing, en grados (rotación) o en unidades de textura (el desplazamiento vertical de "spawn"). */
  amplitude: number;
}

export const DEFAULT_PRESET_PARAMS: PresetParams = { speed: 1, amplitude: 20 };

/** Qué hueso de la geometría juega cada rol anatómico, por `mobId` -- ver comentario del módulo. `legs` alterna de a pares consecutivos (0/1 en contra-fase, 2/3 en contra-fase, ...) -- simplificación deliberada del paso de las 8 patas de la Araña (no persigue un gait tripode biológicamente exacto, ver "Diseño técnico" del documento de definición: los presets son una PRIMERA pasada, el timeline manual permite afinar). */
export interface PresetRoleBones {
  root: string;
  head?: string;
  arms?: [right: string, left: string];
  legs?: string[];
}

const PRESET_ROLE_BONES: Record<string, PresetRoleBones> = {
  skeleton: { root: 'body', head: 'head', arms: ['armRight', 'armLeft'], legs: ['legRight', 'legLeft'] },
  zombie: { root: 'body', head: 'head', arms: ['armRight', 'armLeft'], legs: ['legRight', 'legLeft'] },
  creeper: { root: 'body', head: 'head', legs: ['legFrontRight', 'legFrontLeft', 'legBackRight', 'legBackLeft'] },
  spider: {
    root: 'thorax',
    head: 'head',
    legs: ['leg1Right', 'leg1Left', 'leg2Right', 'leg2Left', 'leg3Right', 'leg3Left', 'leg4Right', 'leg4Left'],
  },
};

export function getPresetRoleBones(mobId: string): PresetRoleBones | undefined {
  return PRESET_ROLE_BONES[mobId];
}

const ZERO: AnimationKeyframe['rotation'] = { x: 0, y: 0, z: 0 };

/** Redondea a 3 decimales -- suficiente precisión para un ángulo en grados, evita que un valor teóricamente cero (`Math.sin` de un múltiplo de π rara vez da exactamente `0` por precisión de punto flotante, ej. `3.67e-16`) se muestre como notación exponencial fea en los inputs numéricos del timeline (`AnimationEditor.tsx`, hallazgo real visto en vivo durante el QA de este ticket). */
function roundAngle(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * `samples + 1` keyframes (de `t=0` a `t=length` inclusive, cerrando el
 * loop -- el ultimo vale lo mismo que el primero, salvo un error de
 * punto flotante despreciable ya absorbido por `roundAngle`) con un
 * swing senoidal en un solo eje. `phaseOffset` (radianes) desfasa el
 * swing -- ej. la pierna izquierda usa `Math.PI` para moverse en
 * contra-fase de la derecha.
 */
function generateSineKeyframes(length: number, samples: number, axis: 'x' | 'y' | 'z', amplitudeDeg: number, phaseOffset: number): AnimationKeyframe[] {
  const keyframes: AnimationKeyframe[] = [];
  for (let i = 0; i <= samples; i++) {
    const time = (length * i) / samples;
    const angle = 2 * Math.PI * (i / samples) + phaseOffset;
    const value = roundAngle(amplitudeDeg * Math.sin(angle));
    keyframes.push({ time, rotation: { ...ZERO, [axis]: value } });
  }
  return keyframes;
}

const SAMPLES_PER_LOOP_CYCLE = 8;

function buildIdle(role: PresetRoleBones, params: PresetParams): MobAnimation {
  const length = 1 / params.speed;
  const bones: Record<string, AnimationKeyframe[]> = {};
  if (role.arms) {
    const [right, left] = role.arms;
    bones[right] = generateSineKeyframes(length, SAMPLES_PER_LOOP_CYCLE, 'x', params.amplitude * 0.3, 0);
    bones[left] = generateSineKeyframes(length, SAMPLES_PER_LOOP_CYCLE, 'x', params.amplitude * 0.3, Math.PI);
  }
  if (role.head) {
    bones[role.head] = generateSineKeyframes(length, SAMPLES_PER_LOOP_CYCLE, 'y', params.amplitude * 0.15, 0);
  }
  return { name: 'idle', loop: true, length, bones };
}

function buildWalk(role: PresetRoleBones, params: PresetParams): MobAnimation {
  const length = 1 / params.speed;
  const bones: Record<string, AnimationKeyframe[]> = {};
  const legs = role.legs ?? [];
  legs.forEach((legName, index) => {
    const phase = index % 2 === 0 ? 0 : Math.PI;
    bones[legName] = generateSineKeyframes(length, SAMPLES_PER_LOOP_CYCLE, 'x', params.amplitude, phase);
  });
  if (role.arms) {
    const [right, left] = role.arms;
    // Brazo contrario a la pierna del mismo lado (marcha humana natural) -- fase de `legs[0]` es 0, asi que el brazo derecho usa Math.PI (contra-fase), y viceversa.
    bones[right] = generateSineKeyframes(length, SAMPLES_PER_LOOP_CYCLE, 'x', params.amplitude * 0.6, Math.PI);
    bones[left] = generateSineKeyframes(length, SAMPLES_PER_LOOP_CYCLE, 'x', params.amplitude * 0.6, 0);
  }
  return { name: 'walk', loop: true, length, bones };
}

function buildAttack(role: PresetRoleBones, params: PresetParams): MobAnimation {
  const length = 0.5 / params.speed;
  const peak = length * 0.4;
  const bones: Record<string, AnimationKeyframe[]> = {};
  const swingBone = role.arms?.[0] ?? role.head;
  if (swingBone) {
    bones[swingBone] = [
      { time: 0, rotation: ZERO },
      { time: peak, rotation: { ...ZERO, x: -params.amplitude } },
      { time: length, rotation: ZERO },
    ];
  }
  return { name: 'attack', loop: false, length, bones };
}

function buildSpawn(role: PresetRoleBones, params: PresetParams): MobAnimation {
  const length = 0.6 / params.speed;
  return {
    name: 'spawn',
    loop: false,
    length,
    bones: {
      [role.root]: [
        { time: 0, rotation: ZERO, position: { x: 0, y: -params.amplitude, z: 0 } },
        { time: length, rotation: ZERO, position: { x: 0, y: 0, z: 0 } },
      ],
    },
  };
}

function buildDeath(role: PresetRoleBones, params: PresetParams): MobAnimation {
  const length = 1 / params.speed;
  return {
    name: 'death',
    loop: false,
    length,
    bones: {
      // No vuelve a 0 -- termina "caído" a propósito (no es un loop).
      [role.root]: [
        { time: 0, rotation: ZERO },
        { time: length, rotation: { x: 0, y: 0, z: 90 } },
      ],
    },
  };
}

const PRESET_BUILDERS: Record<RecognizedAnimationName, (role: PresetRoleBones, params: PresetParams) => MobAnimation> = {
  idle: buildIdle,
  walk: buildWalk,
  attack: buildAttack,
  spawn: buildSpawn,
  death: buildDeath,
};

/** Todos los nombres de hueso que un preset PODRÍA llegar a usar (esencial + de mejora) -- para `getMissingBonesForPreset`. */
function bonesReferencedByPreset(preset: RecognizedAnimationName, role: PresetRoleBones): string[] {
  const names: string[] = [];
  if (preset === 'idle' || preset === 'walk' || preset === 'attack') {
    if (role.arms) names.push(...role.arms);
  }
  if (preset === 'idle' || preset === 'attack') {
    if (role.head) names.push(role.head);
  }
  if (preset === 'walk') {
    names.push(...(role.legs ?? []));
  }
  if (preset === 'spawn' || preset === 'death') {
    names.push(role.root);
  }
  return names;
}

/**
 * De los huesos que el preset ESENCIALMENTE necesita para producir
 * cualquier movimiento (no solo "de mejora"), cuáles NO existen en
 * `geometry.parts` -- vacío si el preset puede aplicarse. Un mob sin
 * brazos (Creeper/Araña) no vuelve inválidos a `idle`/`attack` (usan la
 * cabeza como alternativa) -- solo `walk` sin ninguna pierna, o
 * `spawn`/`death` sin el hueso raíz declarado, cuentan como "esencial
 * faltante".
 */
export function getMissingBonesForPreset(preset: RecognizedAnimationName, role: PresetRoleBones, geometry: MobGeometry): string[] {
  const referenced = bonesReferencedByPreset(preset, role);
  const missing = referenced.filter((name) => !(name in geometry.parts));

  if (preset === 'walk') {
    const declaredLegs = role.legs ?? [];
    const existingLegs = declaredLegs.filter((name) => name in geometry.parts);
    if (existingLegs.length >= 2) return [];
    // Necesita al menos un PAR de piernas para alternar -- si ninguna
    // esta declarada para este mob (no deberia pasar con los 4 mobs
    // conocidos, ver `PRESET_ROLE_BONES`, pero es una entrada de datos
    // externa via `mobId`), se avisa igual en vez de generar una
    // animacion vacia en silencio.
    return declaredLegs.length > 0 ? declaredLegs : ['(este mob no tiene huesos de pierna conocidos)'];
  }
  if (preset === 'idle' || preset === 'attack') {
    const hasHead = role.head !== undefined && role.head in geometry.parts;
    const hasArm = role.arms?.some((name) => name in geometry.parts) ?? false;
    if (!hasHead && !hasArm) return missing;
    return [];
  }
  // spawn/death: esencial = el hueso raiz.
  return role.root in geometry.parts ? [] : [role.root];
}

export type GeneratePresetResult = { ok: true; animation: MobAnimation } | { ok: false; missingBones: string[] };

/**
 * Genera la animación de `preset` para `mobId`/`geometry` con `params`
 * -- HU-9. Si la geometría no tiene los huesos esenciales que ese
 * preset necesita (`getMissingBonesForPreset`), no genera nada y
 * devuelve la lista de huesos que faltan para que la UI muestre un
 * aviso claro (criterio de aceptación: "sin romper el modelo").
 * Huesos de "mejora" ausentes (ej. brazos en un `walk` de Creeper) se
 * omiten en silencio -- el preset sigue siendo válido sin ellos.
 */
export function generatePresetAnimation(preset: RecognizedAnimationName, mobId: string, geometry: MobGeometry, params: PresetParams = DEFAULT_PRESET_PARAMS): GeneratePresetResult {
  const role = getPresetRoleBones(mobId) ?? { root: Object.keys(geometry.parts)[0] ?? '' };
  const missingBones = getMissingBonesForPreset(preset, role, geometry);
  if (missingBones.length > 0) return { ok: false, missingBones };

  const filteredRole: PresetRoleBones = {
    root: role.root,
    head: role.head && role.head in geometry.parts ? role.head : undefined,
    arms: role.arms && role.arms.every((name) => name in geometry.parts) ? role.arms : undefined,
    legs: role.legs?.filter((name) => name in geometry.parts),
  };

  return { ok: true, animation: PRESET_BUILDERS[preset](filteredRole, params) };
}
