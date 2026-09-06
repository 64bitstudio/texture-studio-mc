import type { FaceLabels, MobGeometry } from '../types/baseAssets.js';

// Factory compartida para la geometria "biped clasica" de 6 cajas (UV
// legado 64xN) -- extraida en el ticket 017 al detectar, via el gate de
// calidad de SonarQube (`new_duplicated_lines_density`), que
// `skeletonGeometry.ts` y `zombieGeometry.ts` repetian literalmente los
// mismos `faceLabels` y las mismas cajas de cabeza/torso: el Esqueleto y
// el Zombie son ambos un biped clasico con cabeza (8x8x8) y torso
// (8x12x4) IDENTICOS en tamaño/posicion/UV -- lo unico que varia entre
// mobs de este tipo es el tamaño de brazos/piernas (huesos delgados vs.
// gruesos tipo Steve), el offset en x de sus posiciones, y el alto real
// de la textura sevida (32 para el Esqueleto, 64 para el Zombie, ver
// `zombieGeometry.ts`). Esta funcion es la UNICA fuente de esa
// estructura compartida -- cada archivo de geometria por mob solo provee
// los valores que SI le son propios, ya verificados contra
// `bedrock-samples` + el asset vanilla real (ver el comentario de cada
// uno para su propia investigacion).
//
// Convencion de ejes: +x = derecha de pantalla (viendo el modelo de
// frente), +y = arriba, +z = hacia la camara (frente del personaje).
// Origen en el centro de los pies (y=0). Coordenadas UV (origen de cada
// "cross" de caja) y posiciones/tamaños de caja: informacion publica del
// formato de modelo de Minecraft (no un asset con copyright de Mojang).
//
// `mirrorX` en armLeft/legLeft: el formato legado 64xN no tiene UV
// propio para el lado izquierdo -- Minecraft reutiliza la misma region
// de armRight/legRight, reflejada horizontalmente. El renderer del
// frontend replica ese mismo comportamiento (ver
// `frontend/src/geometry/applyBoxUV.ts`).
//
// `group` (ticket 020): antes de este ticket, `armRight`/`armLeft` y
// `legRight`/`legLeft` se agrupaban via una tabla estatica aparte
// (`PART_GROUP_KEY` en `frontend/src/regionLabels.ts`) que asumia las 6
// claves fijas de un biped. Con `MobGeometry.parts` generalizado a
// `Record<string, MobBoxPart>` para dar cabida a la Araña (8 patas
// compartiendo una sola region UV), esa tabla estatica ya no puede
// cubrir cualquier mob futuro -- se reemplaza por este campo explicito
// por parte, mismo dato, sin tabla aparte que mantener sincronizada.
//
// Convencion `left`/`right` de `faceLabels` (ticket 011): lado ANATOMICO
// del personaje (izquierdo/derecho), no pantalla-izquierda/derecha. Como
// el personaje esta de frente a la camara, la cara `right` (+x,
// pantalla-derecha) es el lado IZQUIERDO del personaje, y la cara `left`
// (-x, pantalla-izquierda) es su lado DERECHO -- verificado en vivo (ver
// docs/ARQUITECTURA.md, "Ticket 011"). `armRight`/`armLeft` (y
// `legRight`/`legLeft`) comparten EXACTAMENTE la misma region UV (mismo
// `uv`, mismo tamaño): pintar ahi afecta a ambos lados 3D a la vez, por
// eso sus `faceLabels` son deliberadamente SIN lateralidad ("Brazo --
// ...", no "Brazo derecho -- ...").
export const HEAD_FACE_LABELS: FaceLabels = {
  front: 'Cara',
  back: 'Nuca',
  top: 'Parte superior',
  bottom: 'Parte inferior',
  left: 'Lateral derecho',
  right: 'Lateral izquierdo',
};

export const BODY_FACE_LABELS: FaceLabels = {
  front: 'Pecho',
  back: 'Espalda',
  top: 'Parte superior',
  bottom: 'Parte inferior',
  left: 'Costado derecho',
  right: 'Costado izquierdo',
};

export const ARM_FACE_LABELS: FaceLabels = {
  front: 'Brazo — Frente',
  back: 'Brazo — Atrás',
  top: 'Brazo — Superior',
  bottom: 'Brazo — Inferior',
  left: 'Brazo — Lateral',
  right: 'Brazo — Lateral',
};

export const LEG_FACE_LABELS: FaceLabels = {
  front: 'Pierna — Frente',
  back: 'Pierna — Atrás',
  top: 'Pierna — Superior',
  bottom: 'Pierna — Inferior',
  left: 'Pierna — Lateral',
  right: 'Pierna — Lateral',
};

/** Tamaño/offset de brazos y piernas -- lo unico que distingue un biped clasico de otro. */
export interface ClassicBipedLimbs {
  /** `[ancho, alto, profundidad]`, igual para brazos y piernas de este mob. */
  size: [number, number, number];
  /** Brazo derecho en `x = -armOffsetX`, izquierdo en `x = +armOffsetX`. */
  armOffsetX: number;
  /** Pierna derecha en `x = -legOffsetX`, izquierda en `x = +legOffsetX`. */
  legOffsetX: number;
}

/**
 * Construye la `MobGeometry` de un biped clasico de 6 cajas: cabeza y
 * torso son SIEMPRE `[8,8,8]`/`[8,12,4]` en las mismas posiciones/UV
 * (identicas en cualquier mob de este tipo -- Esqueleto y Zombie, verificado
 * contra `bedrock-samples` para ambos), brazos/piernas parametrizados
 * por `limbs` (unica diferencia real entre estos dos mobs).
 */
export function buildClassicBipedGeometry(textureHeight: number, limbs: ClassicBipedLimbs): MobGeometry {
  const { size, armOffsetX, legOffsetX } = limbs;

  return {
    textureWidth: 64,
    textureHeight,
    parts: {
      head: {
        size: [8, 8, 8],
        position: [0, 28, 0],
        uv: { x: 0, y: 0 },
        faceLabels: HEAD_FACE_LABELS,
      },
      body: {
        size: [8, 12, 4],
        position: [0, 18, 0],
        uv: { x: 16, y: 16 },
        faceLabels: BODY_FACE_LABELS,
      },
      armRight: {
        size,
        position: [-armOffsetX, 18, 0],
        uv: { x: 40, y: 16 },
        faceLabels: ARM_FACE_LABELS,
        group: 'arm',
      },
      armLeft: {
        size,
        position: [armOffsetX, 18, 0],
        uv: { x: 40, y: 16 },
        mirrorX: true,
        faceLabels: ARM_FACE_LABELS,
        group: 'arm',
      },
      legRight: {
        size,
        position: [-legOffsetX, 6, 0],
        uv: { x: 0, y: 16 },
        faceLabels: LEG_FACE_LABELS,
        group: 'leg',
      },
      legLeft: {
        size,
        position: [legOffsetX, 6, 0],
        uv: { x: 0, y: 16 },
        mirrorX: true,
        faceLabels: LEG_FACE_LABELS,
        group: 'leg',
      },
    },
  };
}
