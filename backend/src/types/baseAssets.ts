// Contrato de `GET /api/base-assets/skeleton` (ticket 001). Ver
// docs/API.md y docs/ARQUITECTURA.md para el detalle completo.
//
// Diseño: un solo endpoint devuelve tanto la textura (como data URL
// base64, para no necesitar una segunda request/endpoint de imagen
// estática) como la definición de geometria/UV -- decisión tomada en
// este ticket porque el documento de definición no especificaba la
// forma exacta del contrato, solo que "devuelve la textura base + la
// definición de geometría/UV" en un único endpoint (ver postman
// collection, ya listaba un solo endpoint).

/** Origen (esquina superior izquierda) del "cross" de UV de una caja, en pixeles de textura. */
export interface BoxUvOrigin {
  x: number;
  y: number;
}

/**
 * Nombres legibles (es-MX) de cada una de las 6 caras del "cross" UV de
 * una caja (ticket 011, HU sin numero previo -- feedback directo de
 * Marco, ver `pending/011-regiones-uv-nombradas.md`). Las claves
 * coinciden EXACTAMENTE con los nombres de region ya usados por
 * `frontend/src/geometry/applyBoxUV.ts` (`front`/`back`/`top`/`bottom`/
 * `left`/`right`) -- no se inventa una segunda nomenclatura de caras.
 *
 * Convencion `left`/`right`: son las mismas caras +x/-x del sistema de
 * coordenadas de la caja (ver "Convencion de ejes" en
 * `skeletonGeometry.ts`), NO relativas a la camara/pantalla. Como el
 * personaje esta de frente a la camara (+z = frente), su lado
 * anatomico DERECHO cae del lado -x (pantalla-izquierda) y su
 * IZQUIERDO del lado +x (pantalla-derecha) -- exactamente la misma
 * convencion ya usada por `armRight`/`armLeft` (`armRight.position.x =
 * -5`, pantalla-izquierda). Por eso `right` (cara +x) se etiqueta con
 * el lado IZQUIERDO del personaje y `left` (cara -x) con su DERECHO --
 * ver docs/ARQUITECTURA.md, "Ticket 011", para la verificacion en vivo
 * de este mapeo.
 */
export interface FaceLabels {
  front: string;
  back: string;
  top: string;
  bottom: string;
  left: string;
  right: string;
}

/**
 * Definición de una caja del modelo (formato de caja de Minecraft:
 * tamaño width/height/depth en unidades de pixel de textura, más el
 * origen de su "cross" UV clásico).
 *
 * `mirrorX`: el formato legado 64x32 NO tiene una región UV propia para
 * el lado izquierdo de brazo/pierna -- el juego reutiliza la MISMA
 * región del lado derecho, reflejada horizontalmente. Ver
 * docs/ARQUITECTURA.md ("Mapeo UV de cajas") para la derivación
 * completa, verificada contra `~/tools/minecraft-texture-pack/
 * mc_render_preview.py` (ya calibrado, mismo criterio que el documento
 * de definición).
 *
 * `faceLabels` (ticket 011): nombre legible de cada una de las 6 caras
 * de esta caja, para el editor de textura (tooltip/etiqueta + overlay
 * de fronteras). Ver docs/ARQUITECTURA.md, "Ticket 011", para el
 * catalogo completo y las decisiones no cubiertas literalmente por el
 * ticket (labels de brazo/pierna sin lateralidad, top/bottom de body).
 */
export interface SkeletonBoxPart {
  size: [number, number, number];
  position: [number, number, number];
  uv: BoxUvOrigin;
  mirrorX?: boolean;
  faceLabels: FaceLabels;
}

export interface SkeletonGeometry {
  textureWidth: number;
  textureHeight: number;
  parts: {
    head: SkeletonBoxPart;
    body: SkeletonBoxPart;
    armRight: SkeletonBoxPart;
    armLeft: SkeletonBoxPart;
    legRight: SkeletonBoxPart;
    legLeft: SkeletonBoxPart;
  };
}

export interface SkeletonTexture {
  /** `data:image/png;base64,...` -- 64x32 PNG, real o placeholder. */
  dataUrl: string;
  width: number;
  height: number;
  /** true cuando `vanilla-assets/skeleton.png` no existe todavía (ver ticket 007) y se sirvió el placeholder procedural. */
  isPlaceholder: boolean;
}

export interface SkeletonBaseAssetsResponse {
  texture: SkeletonTexture;
  geometry: SkeletonGeometry;
}
