import type { SkeletonGeometry } from '../types/baseAssets.js';

// Geometria por cajas + UV clasico 64x32 del modelo biped vanilla del
// Esqueleto, tal como pide el ticket 001 y especifica
// docs/definiciones/editor-3d-texturas-esqueleto.md ("Diseño técnico").
//
// Coordenadas UV (origen de cada "cross" de caja) y posiciones/tamaños
// de caja: informacion publica del formato de modelo de Minecraft (no
// un asset con copyright de Mojang).
//
// Convencion de ejes: +x = derecha de pantalla (viendo el modelo de
// frente), +y = arriba, +z = hacia la camara (frente del personaje).
// Origen en el centro de los pies (y=0).
//
// mirrorX en armLeft/legLeft: el formato legado 64x32 no tiene UV
// propio para el lado izquierdo -- Minecraft reutiliza la misma region
// de armRight/legRight, reflejada horizontalmente. El renderer del
// frontend replica ese mismo comportamiento (ver
// frontend/src/geometry/applyBoxUV.ts).
//
// CORRECCION (ticket 009): `armRight`/`armLeft`/`legRight`/`legLeft`
// usaban `size [4,12,4]` (proporcion de Steve/humanoide generico,
// copiada sin verificar de `~/tools/minecraft-texture-pack/
// mc_render_preview.py`) -- el Esqueleto real de Minecraft usa huesos
// delgados `[2,12,2]`, con el brazo en `position.x = ∓5` (no `∓6`; las
// piernas no cambian de posicion, solo de tamaño). Verificado contra
// DOS fuentes independientes -- procedimiento que queda como el
// metodo ESTANDAR a seguir para calibrar la geometria de cualquier mob
// futuro (ver docs/ARQUITECTURA.md, "Ticket 009"):
//   1. Fuente oficial: `Mojang/bedrock-samples/resource_pack/models/
//      entity/skeleton.geo.json` (repo publico de Mojang para addons) --
//      `right_arm`/`left_arm`/`right_leg`/`left_leg` = size [2,12,2],
//      brazos con origen x=∓5.
//   2. Verificacion empirica pixel a pixel contra el `skeleton.png`
//      vanilla real ya cacheado (`~/tools/minecraft-texture-pack/
//      vanilla-cache/skeleton.png`): el patron de pixeles opacos en las
//      columnas 0-7 (piernas) y 40-47 (brazos) coincide EXACTAMENTE con
//      el cross UV que genera una caja de 2x12x2 en esos origenes (8
//      columnas de ancho total, no 16) -- confirma que el layout UV
//      previo (que asumia cajas de 16 de ancho) tambien estaba mal, no
//      solo el grosor 3D.
// Cabeza (8x8x8) y torso (8x12x4) ya eran correctos -- no se tocan. El
// UV cross de cada caja se recalcula solo (`frontend/src/geometry/
// applyBoxUV.ts` lo deriva del tamaño de caja recibido, sin ningun
// valor hardcodeado que asuma un ancho de caja especifico).
//
// TICKET 011 -- `faceLabels`: nombres legibles por cara, para el editor
// de textura (tooltip/etiqueta + overlay de fronteras entre regiones).
// Ver `docs/ARQUITECTURA.md`, "Ticket 011", para el detalle completo de
// cada decision. Resumen de las dos que no estaban resueltas por el
// ticket:
//
// 1) `left`/`right` de cabeza/torso usan el lado ANATOMICO del
//    personaje (izquierdo/derecho), no pantalla-izquierda/derecha --
//    misma convencion que ya usan `armRight`/`armLeft` en este mismo
//    archivo. Como el personaje esta de frente a la camara, la cara
//    `right` (+x, pantalla-derecha) es el lado IZQUIERDO del personaje,
//    y la cara `left` (-x, pantalla-izquierda) es su lado DERECHO.
//    Verificado en vivo (ver docs/ARQUITECTURA.md).
// 2) `armRight`/`armLeft` (y `legRight`/`legLeft`) comparten EXACTAMENTE
//    la misma region UV (mismo `uv`, mismo tamaño -- ver `mirrorX`
//    arriba): pintar ahi afecta a ambos lados 3D a la vez. Por eso sus
//    `faceLabels` son deliberadamente SIN lateralidad ("Brazo -- ...",
//    no "Brazo derecho -- ...") -- decirle al usuario "brazo derecho"
//    cuando el pixel tambien pinta el brazo izquierdo seria enganoso.
//    Esto se aparta del ejemplo literal del ticket ("Brazo derecho --
//    frente"), con la razon documentada aca y en docs/ARQUITECTURA.md.
const HEAD_FACE_LABELS = {
  front: 'Cara',
  back: 'Nuca',
  top: 'Parte superior',
  bottom: 'Parte inferior',
  left: 'Lateral derecho',
  right: 'Lateral izquierdo',
};

const BODY_FACE_LABELS = {
  front: 'Pecho',
  back: 'Espalda',
  top: 'Parte superior',
  bottom: 'Parte inferior',
  left: 'Costado derecho',
  right: 'Costado izquierdo',
};

const ARM_FACE_LABELS = {
  front: 'Brazo — Frente',
  back: 'Brazo — Atrás',
  top: 'Brazo — Superior',
  bottom: 'Brazo — Inferior',
  left: 'Brazo — Lateral',
  right: 'Brazo — Lateral',
};

const LEG_FACE_LABELS = {
  front: 'Pierna — Frente',
  back: 'Pierna — Atrás',
  top: 'Pierna — Superior',
  bottom: 'Pierna — Inferior',
  left: 'Pierna — Lateral',
  right: 'Pierna — Lateral',
};

export const SKELETON_GEOMETRY: SkeletonGeometry = {
  textureWidth: 64,
  textureHeight: 32,
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
      size: [2, 12, 2],
      position: [-5, 18, 0],
      uv: { x: 40, y: 16 },
      faceLabels: ARM_FACE_LABELS,
    },
    armLeft: {
      size: [2, 12, 2],
      position: [5, 18, 0],
      uv: { x: 40, y: 16 },
      mirrorX: true,
      faceLabels: ARM_FACE_LABELS,
    },
    legRight: {
      size: [2, 12, 2],
      position: [-2, 6, 0],
      uv: { x: 0, y: 16 },
      faceLabels: LEG_FACE_LABELS,
    },
    legLeft: {
      size: [2, 12, 2],
      position: [2, 6, 0],
      uv: { x: 0, y: 16 },
      mirrorX: true,
      faceLabels: LEG_FACE_LABELS,
    },
  },
};
