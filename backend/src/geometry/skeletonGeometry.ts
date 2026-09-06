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
export const SKELETON_GEOMETRY: SkeletonGeometry = {
  textureWidth: 64,
  textureHeight: 32,
  parts: {
    head: {
      size: [8, 8, 8],
      position: [0, 28, 0],
      uv: { x: 0, y: 0 },
    },
    body: {
      size: [8, 12, 4],
      position: [0, 18, 0],
      uv: { x: 16, y: 16 },
    },
    armRight: {
      size: [2, 12, 2],
      position: [-5, 18, 0],
      uv: { x: 40, y: 16 },
    },
    armLeft: {
      size: [2, 12, 2],
      position: [5, 18, 0],
      uv: { x: 40, y: 16 },
      mirrorX: true,
    },
    legRight: {
      size: [2, 12, 2],
      position: [-2, 6, 0],
      uv: { x: 0, y: 16 },
    },
    legLeft: {
      size: [2, 12, 2],
      position: [2, 6, 0],
      uv: { x: 0, y: 16 },
      mirrorX: true,
    },
  },
};
