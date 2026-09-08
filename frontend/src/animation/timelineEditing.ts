// Ticket 090 -- edición manual del timeline (Etapa 4, HU-10) y
// validaciones de nombre/advertencias (HU-9). Ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.
//
// Deliberadamente puro -- mismo criterio que `modelEditing.ts`/
// `hierarchy.ts` (ver `frontend/test/timelineEditing.spec.ts`).

import type { AnimationKeyframe, MobAnimation } from '../projectStorage';
import type { Vec3 } from './interpolation';

/**
 * Los 5 nombres que FreeMinecraftModels reconoce para disparo
 * automático (ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md,
 * "Riesgos y preguntas abiertas" -- hallazgo confirmado del spike del
 * ticket 080). Un nombre fuera de esta lista sigue siendo válido (HU-9,
 * criterio 4) -- simplemente no se dispara solo en el juego.
 */
export const RECOGNIZED_ANIMATION_NAMES = ['spawn', 'idle', 'walk', 'attack', 'death'] as const;
export type RecognizedAnimationName = (typeof RECOGNIZED_ANIMATION_NAMES)[number];

export function isRecognizedAnimationName(name: string): name is RecognizedAnimationName {
  return (RECOGNIZED_ANIMATION_NAMES as readonly string[]).includes(name);
}

/** Crea una animación vacía (sin keyframes todavía) -- punto de partida tanto del timeline manual desde cero como de la base sobre la que un preset escribe sus huesos. */
export function createEmptyAnimation(name: string, length: number, loop: boolean): MobAnimation {
  return { name, length, loop, bones: {} };
}

function sortKeyframes(keyframes: AnimationKeyframe[]): AnimationKeyframe[] {
  return [...keyframes].sort((a, b) => a.time - b.time);
}

/**
 * Agrega (o reemplaza, si ya existe uno en el mismo instante exacto --
 * mover un keyframe encima de otro los fusiona en vez de dejar dos
 * competiendo por el mismo tiempo) un keyframe de `boneName` en
 * `time`. Siempre devuelve la lista de ese hueso ORDENADA por tiempo --
 * precondición de `sampleBoneAtTime` (`interpolation.ts`).
 */
export function addKeyframe(animation: MobAnimation, boneName: string, keyframe: AnimationKeyframe): MobAnimation {
  const existing = animation.bones[boneName] ?? [];
  const withoutSameTime = existing.filter((k) => k.time !== keyframe.time);
  const bones = { ...animation.bones, [boneName]: sortKeyframes([...withoutSameTime, keyframe]) };
  return { ...animation, bones };
}

/** Mueve un keyframe existente de `fromTime` a `toTime` (mismo hueso) -- no-op seguro si no existe uno en `fromTime`. Fusiona con uno ya existente en `toTime`, mismo criterio que `addKeyframe`. */
export function moveKeyframe(animation: MobAnimation, boneName: string, fromTime: number, toTime: number): MobAnimation {
  const existing = animation.bones[boneName] ?? [];
  const found = existing.find((k) => k.time === fromTime);
  if (!found) return animation;
  return addKeyframe({ ...animation, bones: { ...animation.bones, [boneName]: existing.filter((k) => k.time !== fromTime) } }, boneName, { ...found, time: toTime });
}

/** Elimina el keyframe de `boneName` en `time` -- no-op seguro si no existe. Un hueso que se queda sin keyframes desaparece de `bones` (no queda una lista vacía huérfana). */
export function removeKeyframe(animation: MobAnimation, boneName: string, time: number): MobAnimation {
  const existing = animation.bones[boneName];
  if (!existing) return animation;
  const remaining = existing.filter((k) => k.time !== time);
  const bones = { ...animation.bones };
  if (remaining.length === 0) {
    delete bones[boneName];
  } else {
    bones[boneName] = remaining;
  }
  return { ...animation, bones };
}

/** Actualiza los valores (rotation/position/scale) de un keyframe ya existente, sin mover su `time`. No-op seguro si no existe. */
export function updateKeyframeValue(animation: MobAnimation, boneName: string, time: number, update: Partial<Pick<AnimationKeyframe, 'rotation' | 'position' | 'scale'>>): MobAnimation {
  const existing = animation.bones[boneName];
  if (!existing) return animation;
  const bones = { ...animation.bones, [boneName]: existing.map((k) => (k.time === time ? { ...k, ...update } : k)) };
  return { ...animation, bones };
}

export const ZERO_ROTATION: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * HU-9, criterio 3: crear una `walk` sin una `idle` en el mismo mob
 * deja al mob sin forma de volver a reposo en el juego (restricción
 * documentada del plugin, ver el spike del ticket 080) -- se advierte,
 * SIN bloquear la creación/exportación si el usuario decide continuar
 * de todas formas.
 */
export function checkWalkRequiresIdle(animations: readonly Pick<MobAnimation, 'name'>[]): string | null {
  const hasWalk = animations.some((a) => a.name === 'walk');
  const hasIdle = animations.some((a) => a.name === 'idle');
  if (hasWalk && !hasIdle) {
    return 'Este mob tiene una animación "walk" pero no una "idle" -- sin ella, el mob no podrá volver a reposo en el juego (FreeMinecraftModels solo sale de "walk" hacia "idle"). Puedes continuar, pero se recomienda agregar una "idle".';
  }
  return null;
}
