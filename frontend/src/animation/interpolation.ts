// Ticket 090 -- muestreo/interpolación de animaciones (Etapa 4). Ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.
//
// Deliberadamente puro -- sin React/three.js -- mismo criterio de
// testabilidad que `hierarchy.ts`/`packBoxesUV.ts` (ver
// `frontend/test/interpolation.spec.ts`). Interpolación LINEAL entre
// keyframes vecinos (curvas de easing quedan fuera de esta version,
// ver "Diseño técnico" del documento de definición) -- suficiente para
// presets paramétricos y para la primera versión del timeline manual.

import type { AnimationKeyframe, MobAnimation } from '../projectStorage';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Pose resuelta de UN hueso en un instante dado -- SIEMPRE relativa a
 * la pose base del hueso en `MobGeometry` (DELTA, no absoluta): `Viewer3D`
 * (ver `components/Viewer3D.tsx`) SUMA `rotation`/`position` a
 * `part.rotation`/`part.position` y MULTIPLICA `scale` (neutro = 1) --
 * mismo criterio que usa Blockbench/el rig oficial de Minecraft (una
 * animación nunca necesita conocer la rotación de reposo exacta de un
 * hueso para poder "sumarle" un swing). Neutro de `rotation`/`position`
 * es `{x:0,y:0,z:0}`; neutro de `scale` es `{x:1,y:1,z:1}` -- quien
 * genera keyframes (presets o el timeline manual) debe usar el neutro
 * correcto de cada canal, nunca 0 para `scale`.
 *
 * `position`/`scale` solo se incluyen si AMBOS keyframes vecinos los
 * traían (ver `sampleBoneAtTime`) -- un hueso puede animar SOLO
 * rotación (el caso más común, todos los presets de este ticket) sin
 * tocar los otros dos canales para nada.
 */
export interface BonePose {
  rotation: Vec3;
  position?: Vec3;
  scale?: Vec3;
}

/** Mapa hueso -> pose DELTA, listo para pasarle a `Viewer3D` como `boneOverrides` (ver `components/Viewer3D.tsx`). */
export type BoneOverrides = Record<string, BonePose>;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

/**
 * Resuelve la pose de UN hueso en `time` (segundos), a partir de su
 * lista de keyframes (se asume ordenada por `time` -- ver
 * `sortKeyframes` en `timelineEditing.ts`, que es quien la produce).
 * Sin keyframes, devuelve `null` (el hueso no está animado, `Viewer3D`
 * lo deja en su pose base sin override). Antes del primer keyframe o
 * después del último, se sostiene el valor del extremo mas cercano
 * (sin extrapolar) -- el llamador (`sampleAnimationAtTime`) ya resolvió
 * el loop/clamp del tiempo global antes de llegar aca.
 */
export function sampleBoneAtTime(keyframes: readonly AnimationKeyframe[], time: number): BonePose | null {
  if (keyframes.length === 0) return null;
  if (keyframes.length === 1 || time <= keyframes[0]!.time) {
    return { rotation: keyframes[0]!.rotation, position: keyframes[0]!.position, scale: keyframes[0]!.scale };
  }
  const last = keyframes[keyframes.length - 1]!;
  if (time >= last.time) {
    return { rotation: last.rotation, position: last.position, scale: last.scale };
  }

  for (let i = 0; i < keyframes.length - 1; i++) {
    const from = keyframes[i]!;
    const to = keyframes[i + 1]!;
    if (time < from.time || time > to.time) continue;

    const span = to.time - from.time;
    const t = span === 0 ? 0 : (time - from.time) / span;

    const pose: BonePose = { rotation: lerpVec3(from.rotation, to.rotation, t) };
    if (from.position && to.position) pose.position = lerpVec3(from.position, to.position, t);
    if (from.scale && to.scale) pose.scale = lerpVec3(from.scale, to.scale, t);
    return pose;
  }

  // Inalcanzable si `keyframes` esta ordenada (el loop de arriba cubre
  // todo el rango [primero, ultimo]) -- defensivo, nunca debería correr.
  return { rotation: last.rotation, position: last.position, scale: last.scale };
}

/**
 * Resuelve el tiempo efectivo dentro de `[0, animation.length]` -- con
 * loop, envuelve (`%`) para que la reproducción cicle sin saltos;
 * sin loop, sostiene el ultimo frame (clamp) en vez de "desaparecer"
 * la animación al terminar.
 */
export function resolveLoopedTime(animation: Pick<MobAnimation, 'length' | 'loop'>, time: number): number {
  if (animation.length <= 0) return 0;
  if (!animation.loop) return Math.max(0, Math.min(time, animation.length));
  const wrapped = time % animation.length;
  return wrapped < 0 ? wrapped + animation.length : wrapped;
}

/** Muestrea TODOS los huesos animados de `animation` en `time` (segundos, ya en cualquier rango -- el loop/clamp se resuelve aca). */
export function sampleAnimationAtTime(animation: MobAnimation, time: number): BoneOverrides {
  const effectiveTime = resolveLoopedTime(animation, time);
  const overrides: BoneOverrides = {};
  for (const [boneName, keyframes] of Object.entries(animation.bones)) {
    const pose = sampleBoneAtTime(keyframes, effectiveTime);
    if (pose) overrides[boneName] = pose;
  }
  return overrides;
}
