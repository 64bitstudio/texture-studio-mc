// Contrato de `GET /api/base-assets/:mobId` (ticket 001, generalizado en
// el ticket 016 -- ver docs/API.md y docs/ARQUITECTURA.md para el detalle
// completo).
//
// Diseño: un solo endpoint devuelve tanto la textura (como data URL
// base64, para no necesitar una segunda request/endpoint de imagen
// estática) como la definición de geometria/UV -- decisión tomada en
// el ticket 001 porque el documento de definición no especificaba la
// forma exacta del contrato, solo que "devuelve la textura base + la
// definición de geometría/UV" en un único endpoint (ver postman
// collection, ya listaba un solo endpoint).
//
// TICKET 016 -- generalización a registro de mobs: los tipos que antes
// se llamaban `Skeleton*` (`SkeletonGeometry`, `SkeletonBoxPart`,
// `SkeletonTexture`, `SkeletonBaseAssetsResponse`) se renombran a
// `Mob*` -- la FORMA de estos tipos ya era 100% genérica (cajas +
// UV cross, sin nada hardcodeado al Esqueleto), solo el nombre asumía
// un único mob. `SKELETON_GEOMETRY` (en `geometry/skeletonGeometry.ts`)
// sigue siendo la única instancia de `MobGeometry` que existe hasta que
// los tickets 017/020/021 agreguen la suya. `MobGeometry` es un alias
// (no una unión todavía) porque el ticket 016 no agrega ningún mob con
// anatomía distinta -- ver `docs/ARQUITECTURA.md`, "Ticket 016", sobre
// por qué NO se generaliza también la forma de `parts` (fija a
// head/body/armRight/armLeft/legRight/legLeft) en este ticket: Araña y
// Creeper tienen anatomías distintas y su propio ticket de geometría
// decidirá cómo tipar eso, sin necesidad de tocar este archivo de nuevo
// para el caso del Zombie (mismas 6 cajas que el Esqueleto).

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
export interface MobBoxPart {
  size: [number, number, number];
  position: [number, number, number];
  uv: BoxUvOrigin;
  mirrorX?: boolean;
  faceLabels: FaceLabels;
}

/**
 * Geometría completa de un mob biped de 6 cajas (Esqueleto, y el
 * Zombie del ticket 017 -- misma anatomía, ver el documento de
 * definición). Mobs con anatomía distinta (Araña, Creeper) definirán
 * su propia forma en su propio ticket -- no se asume de antemano.
 */
export interface MobGeometry {
  textureWidth: number;
  textureHeight: number;
  parts: {
    head: MobBoxPart;
    body: MobBoxPart;
    armRight: MobBoxPart;
    armLeft: MobBoxPart;
    legRight: MobBoxPart;
    legLeft: MobBoxPart;
  };
}

export interface MobTexture {
  /** `data:image/png;base64,...` -- PNG del tamaño de `geometry.textureWidth/Height`, real o placeholder. */
  dataUrl: string;
  width: number;
  height: number;
  /** true cuando `vanilla-assets/<mobId>.png` no existe todavía (ver ticket 007) y se sirvió el placeholder procedural. */
  isPlaceholder: boolean;
}

export interface MobBaseAssetsResponse {
  texture: MobTexture;
  geometry: MobGeometry;
}
