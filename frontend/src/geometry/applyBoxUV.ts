import * as THREE from 'three';

/**
 * Aplica el mapeo UV clasico "cross" de Minecraft (formato de cajas
 * biped, 64x32/64x64) a un `THREE.BoxGeometry`.
 *
 * Deriva y verifica, contra `~/tools/minecraft-texture-pack/
 * mc_render_preview.py` (pipeline hermano, ya calibrado y en uso), la
 * correspondencia exacta entre el orden de vertices/caras que genera
 * `THREE.BoxGeometry` (px, nx, py, ny, pz, nz) y el layout de 6
 * regiones del UV "cross" clasico:
 *
 *   fila 1 (y: v..v+d):       [ vacio(d) | top(w)    | bottom(w) | vacio ]
 *   fila 2 (y: v+d..v+d+h):   [ right(d) | front(w)  | left(d)   | back(w) ]
 *
 * (las celdas "vacio" de la fila 1 son un hueco real del formato
 * clasico -- no un bug de este calculo, ver mc_texture.py del pipeline
 * hermano para la misma calibracion). Ver docs/ARQUITECTURA.md,
 * seccion "Mapeo UV de cajas", para la derivacion vertice-por-vertice
 * completa.
 *
 * `mirrorX`: el formato legado 64x32 no tiene una region UV propia para
 * el lado izquierdo de brazo/pierna -- Minecraft reutiliza la MISMA
 * region del lado derecho, reflejada horizontalmente en las 6 caras
 * (no solo left/right). Replica exactamente el `mirror: True` de
 * `UV_OLD_64x32` en el script de referencia.
 */
export interface ApplyBoxUVOptions {
  /** Origen (esquina superior izquierda) del "cross" UV, en pixeles de textura. */
  u: number;
  v: number;
  /** Tamaño de la caja: ancho (x), alto (y), profundidad (z), en pixeles de textura. */
  w: number;
  h: number;
  d: number;
  mirrorX?: boolean;
  textureWidth: number;
  textureHeight: number;
}

interface PixelRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function applyBoxUV(geometry: THREE.BoxGeometry, opts: ApplyBoxUVOptions): void {
  const { u, v, w, h, d, mirrorX = false, textureWidth, textureHeight } = opts;

  let right: PixelRect = { x0: u, y0: v + d, x1: u + d, y1: v + d + h };
  let left: PixelRect = { x0: u + d + w, y0: v + d, x1: u + 2 * d + w, y1: v + d + h };
  const top: PixelRect = { x0: u + d, y0: v, x1: u + d + w, y1: v + d };
  const bottom: PixelRect = { x0: u + d + w, y0: v, x1: u + d + 2 * w, y1: v + d };
  const front: PixelRect = { x0: u + d, y0: v + d, x1: u + d + w, y1: v + d + h };
  const back: PixelRect = { x0: u + 2 * d + w, y0: v + d, x1: u + 2 * d + 2 * w, y1: v + d + h };

  if (mirrorX) {
    // El lado izquierdo reutiliza la textura del lado derecho: las
    // caras "right"/"left" de la caja intercambian de region...
    [right, left] = [left, right];
    // ...y ademas TODA la caja se refleja horizontalmente (ver abajo),
    // igual que `mirror: True` en el pipeline de referencia.
  }

  // Orden exacto de THREE.BoxGeometry.addGroup: px(+x), nx(-x), py(+y), ny(-y), pz(+z), nz(-z).
  const facesInBoxGeometryOrder: PixelRect[] = [right, left, top, bottom, front, back];

  const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute;

  const pxToU = (px: number) => px / textureWidth;
  const pyToV = (py: number) => 1 - py / textureHeight;

  facesInBoxGeometryOrder.forEach((rect, faceIndex) => {
    const { x0, y0, x1, y1 } = rect;
    // mirrorX invierte el eje horizontal DENTRO de cada rect (equivalente
    // a espejar la textura recortada antes de pegarla).
    const uLeft = mirrorX ? x1 : x0;
    const uRight = mirrorX ? x0 : x1;

    const base = faceIndex * 4;
    // Vertices por cara, en el orden que genera THREE.BoxGeometry:
    // v0=top-left, v1=top-right, v2=bottom-left, v3=bottom-right
    // (verificado contra face_corners_3d() de mc_render_preview.py).
    uvAttr.setXY(base + 0, pxToU(uLeft), pyToV(y0));
    uvAttr.setXY(base + 1, pxToU(uRight), pyToV(y0));
    uvAttr.setXY(base + 2, pxToU(uLeft), pyToV(y1));
    uvAttr.setXY(base + 3, pxToU(uRight), pyToV(y1));
  });

  uvAttr.needsUpdate = true;
}
