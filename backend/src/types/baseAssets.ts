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
 *
 * `group` (ticket 020): id estable para agrupar partes que comparten
 * EXACTAMENTE la misma region UV (mismo `uv` + mismo `size`) -- ej. las
 * 8 patas de la Araña, o `armRight`/`armLeft` del biped clasico.
 * Opcional: si se omite, el propio nombre de la parte (la clave en
 * `MobGeometry.parts`) es su grupo -- correcto para cualquier parte con
 * region UV propia (cabeza, torso). Ver `frontend/src/regionLabels.ts`
 * (`computeNamedRegions`) para donde se usa: dedupe de regiones
 * identicas y agrupacion del selector "Aislar parte".
 *
 * `swapFrontBack` (ticket 077 -- bug real de renderizado encontrado por
 * Marco viendo el visor 3D de la Araña, cara/nuca invertidas; ver el
 * comentario de `spiderGeometry.ts` para la correccion explicita de
 * Marco sobre como describir esto): intercambia a que cara 3D
 * (`pz`/`nz`) se asigna cada region UV `front`/`back` -- analogo a
 * `mirrorX` (que intercambia `right`/`left`), y con el mismo alcance:
 * SOLO cambia el render 3D (`applyBoxUV.ts`), nunca el mapa de pixeles
 * 2D ni los `faceLabels` (la region de pixeles que dice "Cara" en el
 * editor sigue siendo la misma region, solo cambia sobre cual cara del
 * cubo 3D se pinta).
 */
export interface MobBoxPart {
  size: [number, number, number];
  position: [number, number, number];
  uv: BoxUvOrigin;
  mirrorX?: boolean;
  swapFrontBack?: boolean;
  faceLabels: FaceLabels;
  group?: string;
  /**
   * Punto de rotacion (ticket 024) -- SOLO afecta el visor 3D, nunca el
   * mapa de pixeles/UV/export. Opcional: sin `pivot`, la caja se
   * posiciona directamente en `position` sin rotacion, igual
   * comportamiento que antes de este ticket (Esqueleto/Zombie/Creeper).
   * Con `pivot`, `Viewer3D.tsx` envuelve la caja en un grupo posicionado
   * ahi y rotado segun `rotation`, con la caja posicionada relativa a
   * ese pivote -- necesario para replicar poses oficiales de Mojang
   * (ej. `animation.spider.default_leg_pose`) que solo tienen sentido
   * geometrico rotando alrededor del punto de union con el cuerpo, no
   * del centro de la propia caja.
   */
  pivot?: [number, number, number];
  /** Rotacion en grados (orden XYZ), aplicada alrededor de `pivot`. Ignorado si `pivot` no esta presente. */
  rotation?: [number, number, number];
}

/**
 * Geometría completa de un mob: un conjunto de cajas nombradas
 * (`parts`), cada una con su tamaño/posicion/UV/`faceLabels` propios.
 *
 * TICKET 020 (generalizacion, ver docs/ARQUITECTURA.md "Ticket 020"):
 * hasta el ticket 017 esta forma era la fija de un biped clasico de 6
 * cajas (`head`/`body`/`armRight`/`armLeft`/`legRight`/`legLeft`) --
 * ese comentario dejaba dicho explicitamente que Araña y Creeper, con
 * anatomia distinta (la Araña no tiene brazos ni un unico segmento de
 * torso, y tiene 8 patas), decidirian su propia forma en su propio
 * ticket sin asumir nada de antemano. Esa decision es esta: `parts` es
 * un diccionario de nombre-de-parte -> caja, de tamaño arbitrario. El
 * Esqueleto y el Zombie (`classicBipedGeometry.ts`) siguen usando
 * exactamente las mismas 6 claves de siempre -- este es un
 * ENSANCHAMIENTO del contrato (cualquier consumidor que ya iteraba
 * `Object.values(geometry.parts)`/`Object.keys(geometry.parts)`
 * generica sigue funcionando sin cambios, ver `symmetry.ts`), no una
 * ruptura de los dos mobs existentes -- confirmado corriendo la
 * suite de tests completa (`backend/test/baseAssets.spec.ts` sigue
 * accediendo a `parts.armRight` etc. por nombre, valido con `Record<string, MobBoxPart>`).
 */
export interface MobGeometry {
  textureWidth: number;
  textureHeight: number;
  parts: Record<string, MobBoxPart>;
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
