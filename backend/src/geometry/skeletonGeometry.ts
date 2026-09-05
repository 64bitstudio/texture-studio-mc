import type { SkeletonGeometry } from '../types/baseAssets.js';

// Geometria por cajas + UV clasico 64x32 del modelo biped vanilla
// (Esqueleto/Player), tal como pide el ticket 001 y especifica
// docs/definiciones/editor-3d-texturas-esqueleto.md ("Diseño técnico").
//
// Coordenadas UV (origen de cada "cross" de caja) y posiciones/tamaños
// de caja: informacion publica del formato de modelo de Minecraft (no
// un asset con copyright de Mojang) -- reutilizadas tal cual de
// `~/tools/minecraft-texture-pack/mc_render_preview.py` (BOXES /
// UV_OLD_64x32), que ya las tiene calibradas y en uso para el pipeline
// hermano `minecraft-texture-pack-pipeline`. Mismo criterio que el
// propio documento de definicion ("mismas coordenadas ya calibradas y
// en uso").
//
// Convencion de ejes: +x = derecha de pantalla (viendo el modelo de
// frente), +y = arriba, +z = hacia la camara (frente del personaje).
// Origen en el centro de los pies (y=0).
//
// mirrorX en armLeft/legLeft: el formato legado 64x32 no tiene UV
// propio para el lado izquierdo -- Minecraft reutiliza la misma region
// de armRight/legRight, reflejada horizontalmente (ver
// UV_OLD_64x32["left_arm"]/["left_leg"], mirror: True en el script de
// referencia). El renderer del frontend replica ese mismo
// comportamiento (ver frontend/src/geometry/applyBoxUV.ts).
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
      size: [4, 12, 4],
      position: [-6, 18, 0],
      uv: { x: 40, y: 16 },
    },
    armLeft: {
      size: [4, 12, 4],
      position: [6, 18, 0],
      uv: { x: 40, y: 16 },
      mirrorX: true,
    },
    legRight: {
      size: [4, 12, 4],
      position: [-2, 6, 0],
      uv: { x: 0, y: 16 },
    },
    legLeft: {
      size: [4, 12, 4],
      position: [2, 6, 0],
      uv: { x: 0, y: 16 },
      mirrorX: true,
    },
  },
};
