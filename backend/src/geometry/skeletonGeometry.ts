import { buildClassicBipedGeometry } from './classicBipedGeometry.js';
import type { MobGeometry } from '../types/baseAssets.js';

// Geometria del Esqueleto -- biped clasico de 6 cajas, UV 64x32 (ticket
// 001, `docs/definiciones/editor-3d-texturas-esqueleto.md`, "Diseño
// técnico"). La estructura compartida por cualquier biped clasico
// (cabeza/torso fijos, convencion de ejes, `mirrorX`, `faceLabels`) vive
// en `classicBipedGeometry.ts` (extraida en el ticket 017 para eliminar
// la duplicacion literal con `zombieGeometry.ts` -- ver ese archivo) --
// aqui solo quedan los valores que son propios del Esqueleto.
//
// CORRECCION (ticket 009): `armRight`/`armLeft`/`legRight`/`legLeft`
// usaban `size [4,12,4]` (proporcion de Steve/humanoide generico,
// copiada sin verificar de `~/tools/minecraft-texture-pack/
// mc_render_preview.py`) -- el Esqueleto real de Minecraft usa huesos
// delgados `[2,12,2]`, con el brazo en `position.x = ∓5` (no `∓6`; las
// piernas no cambian de posicion, solo de tamaño). Verificado contra
// DOS fuentes independientes -- procedimiento que queda como el metodo
// ESTANDAR a seguir para calibrar la geometria de cualquier mob futuro
// (ver docs/ARQUITECTURA.md, "Ticket 009"):
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
export const SKELETON_GEOMETRY: MobGeometry = buildClassicBipedGeometry(32, {
  size: [2, 12, 2],
  armOffsetX: 5,
  legOffsetX: 2,
});
