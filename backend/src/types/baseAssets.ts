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
 */
export interface SkeletonBoxPart {
  size: [number, number, number];
  position: [number, number, number];
  uv: BoxUvOrigin;
  mirrorX?: boolean;
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
