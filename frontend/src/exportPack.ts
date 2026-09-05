// Logica PURA de construccion del resource pack (ticket 006, HU-11) --
// sin React/DOM/three.js/JSZip, mismo criterio de testabilidad que
// `textureBuffer.ts`/`history.ts`/`symmetry.ts`/`importImage.ts` (ver
// docs/COMPONENTES.md). Deliberadamente separado de `export.ts` (que si
// depende de `<canvas>`/`JSZip`/descarga en el navegador): aca solo vive
// el objeto/JSON exacto de `pack.mcmeta` y el mapa de archivos del ZIP
// (rutas + contenido), que es la parte con reglas de negocio reales
// (el contrato exacto que exige Minecraft) y por lo tanto la que vale
// la pena testear sin mocks fragiles de canvas/JSZip.
//
// Gotcha real documentado en `~/tools/minecraft-texture-pack/mc_texture.py`
// (pipeline hermano, mismo estandar pack_format): a partir de
// `pack_format` > 64, Minecraft EXIGE tambien `min_format`/`max_format`
// (mismo valor que `pack_format` si no se declara un rango) o el
// cliente rechaza el pack entero como "Incompatible (Broken or
// incompatible)" -- error real visto en `latest.log`: "Pack declares
// support for version newer than 64, but is missing mandatory fields
// min_format and max_format". No omitir ninguno de los 3 campos.

/** `pack_format` 75 == Minecraft Java Edition 1.21.11 (ver docs/definiciones/editor-3d-texturas-esqueleto.md, HU-10/HU-11, y mc_texture.py del pipeline hermano). */
export const RESOURCE_PACK_FORMAT = 75;

/** Ruta dentro del ZIP donde Minecraft espera la textura del Esqueleto (formato vanilla, ver docs/API.md). */
export const SKELETON_PNG_PATH = 'assets/minecraft/textures/entity/skeleton/skeleton.png';

/** Nombre del archivo de metadata del pack, en la raiz del ZIP. */
export const PACK_MCMETA_PATH = 'pack.mcmeta';

/** Descripcion por defecto si no se especifica otra (ticket 006). */
export const DEFAULT_PACK_DESCRIPTION = 'Texture Studio MC — Esqueleto';

export interface PackMcmeta {
  pack: {
    pack_format: number;
    min_format: number;
    max_format: number;
    description: string;
  };
}

/**
 * Construye el objeto exacto de `pack.mcmeta` -- los 3 campos
 * (`pack_format`/`min_format`/`max_format`) siempre en `RESOURCE_PACK_FORMAT`
 * (75), nunca solo `pack_format` (ver gotcha arriba). `JSON.stringify`
 * de este objeto (con indentacion, para que el archivo sea legible si
 * alguien lo abre a mano) es lo que se escribe como contenido del
 * archivo en el ZIP -- ver `buildResourcePackFiles`.
 */
export function buildPackMcmeta(description: string = DEFAULT_PACK_DESCRIPTION): PackMcmeta {
  return {
    pack: {
      pack_format: RESOURCE_PACK_FORMAT,
      min_format: RESOURCE_PACK_FORMAT,
      max_format: RESOURCE_PACK_FORMAT,
      description,
    },
  };
}

/** Un archivo a agregar al ZIP: ruta relativa a la raiz del pack + contenido crudo. */
export interface ResourcePackFile {
  path: string;
  data: string | Uint8Array | ArrayBuffer;
}

/**
 * Arma la lista de archivos del resource pack -- `pack.mcmeta` +
 * `skeleton.png` -- a partir de los bytes PNG YA codificados
 * (`pngBytes`, producidos en el navegador por `canvas.toBlob`, ver
 * `export.ts`). Deliberadamente NO codifica la imagen aca: esta funcion
 * es pura logica de "que archivo va en que ruta con que contenido",
 * testeable sin `<canvas>`/`JSZip` de por medio -- la codificacion PNG
 * en si (que si requiere el navegador) se valida con revision visual en
 * vivo, mismo criterio que el resto de piezas dependientes de DOM en
 * este proyecto (`decodeTexture.ts`).
 *
 * No duplica la fuente de verdad (alcance del ticket, item 4): quien
 * llama a esta funcion es responsable de haber obtenido `pngBytes` a
 * partir del `TextureBuffer` actual (pintado a mano, importado o
 * pegado, sin distincion) -- esta funcion no lee pixeles por su cuenta.
 */
export function buildResourcePackFiles(pngBytes: Uint8Array | ArrayBuffer, description?: string): ResourcePackFile[] {
  return [
    { path: PACK_MCMETA_PATH, data: JSON.stringify(buildPackMcmeta(description), null, 2) },
    { path: SKELETON_PNG_PATH, data: pngBytes },
  ];
}
