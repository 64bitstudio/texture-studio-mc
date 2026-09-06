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

/**
 * Ruta dentro del ZIP donde Minecraft espera la textura de un mob
 * (formato vanilla, ver docs/API.md) -- generalizada en el ticket 044
 * (antes hardcodeada solo al Esqueleto, `SKELETON_PNG_PATH`). El
 * convenio vanilla es el mismo para los 4 mobs del catalogo
 * (`backend/src/mobs/registry.ts`, `MobId`): `assets/minecraft/
 * textures/entity/<mobId>/<mobId>.png` -- confirmado contra
 * `bedrock-samples`/el asset real de cada mob (misma metodologia de
 * verificacion pixel a pixel documentada para agregar cualquier mob
 * nuevo). No valida que `mobId` sea uno de los 4 conocidos -- mismo
 * criterio "generico" que `getMobDefinition` del backend (acepta
 * cualquier string, quien llama es responsable de que sea real).
 */
export function entityTexturePngPath(mobId: string): string {
  return `assets/minecraft/textures/entity/${mobId}/${mobId}.png`;
}

/** Nombre del archivo de metadata del pack, en la raiz del ZIP. */
export const PACK_MCMETA_PATH = 'pack.mcmeta';

/**
 * Descripcion por defecto si no se especifica otra (ticket 006).
 * Generalizada en el ticket 044 -- ya no menciona "Esqueleto": un
 * mismo pack ahora puede traer varios mobs del proyecto, no solo el
 * que estaba activo en el editor.
 */
export const DEFAULT_PACK_DESCRIPTION = 'Texture Studio MC';

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

/** Un mob del proyecto ya codificado a PNG, listo para su lugar en el ZIP -- ver `buildResourcePackFiles`. */
export interface ResourcePackMobInput {
  mobId: string;
  pngBytes: Uint8Array | ArrayBuffer;
}

/**
 * Arma la lista de archivos del resource pack -- `pack.mcmeta` + una
 * textura por cada mob dado -- a partir de bytes PNG YA codificados
 * (`pngBytes`, producidos en el navegador por `canvas.toBlob` o
 * decodificados de un `pngDataUrl` guardado, ver `export.ts`).
 * Deliberadamente NO codifica ninguna imagen aca: esta funcion es pura
 * logica de "que archivos van en que rutas con que contenido",
 * testeable sin `<canvas>`/`JSZip`/`atob` de por medio -- la
 * codificacion PNG en si (que si requiere el navegador) se valida con
 * revision visual en vivo, mismo criterio que el resto de piezas
 * dependientes de DOM en este proyecto (`decodeTexture.ts`).
 *
 * Generalizada en el ticket 044 (HU-4) de "un solo mob hardcodeado" a
 * "N mobs, cada uno en su ruta vanilla real" -- reemplaza a la version
 * anterior de un solo `pngBytes`/`SKELETON_PNG_PATH` (ver
 * `docs/ARQUITECTURA.md`, "Ticket 044"), que exportaba unicamente el
 * mob activo del editor. Un `mobs` vacio produce un ZIP con solo
 * `pack.mcmeta` -- quien llama (`export.ts`) es responsable de no
 * invocar esto con un proyecto sin mobs.
 *
 * No duplica la fuente de verdad (mismo criterio del ticket 006): quien
 * llama a esta funcion es responsable de haber obtenido cada `pngBytes`
 * a partir del contenido real de ese mob (pintado a mano, importado o
 * pegado, sin distincion) -- esta funcion no lee pixeles por su cuenta.
 */
export function buildResourcePackFiles(mobs: ResourcePackMobInput[], description?: string): ResourcePackFile[] {
  return [
    { path: PACK_MCMETA_PATH, data: JSON.stringify(buildPackMcmeta(description), null, 2) },
    ...mobs.map(({ mobId, pngBytes }) => ({ path: entityTexturePngPath(mobId), data: pngBytes })),
  ];
}

/**
 * Decodifica un `pngDataUrl` guardado (`data:image/png;base64,...`,
 * ver `ProjectMobEntry` en `projectStorage.ts`) a los bytes crudos del
 * PNG -- sin pasar por `<canvas>`/`Image` (a diferencia de
 * `decodePngDataUrlToImageData` de `decodeTexture.ts`, que decodifica a
 * PIXELES para poder pintar/reconstruir un `TextureBuffer`): aca solo
 * hace falta el archivo PNG tal cual para meterlo en el ZIP, y el PNG
 * guardado YA paso por `maskPixelsOutsideUVBoxes` al codificarse
 * (`buildProjectSnapshot`, ticket 019/015) -- reconstruir pixeles y
 * volver a codificar solo para exportar seria trabajo redundante y un
 * segundo lugar donde ese masking podria desalinearse.
 *
 * `atob` es un global tanto de navegador como de Node 16+ (usado en
 * este runtime tambien por los tests, `environment: 'node'`) -- por
 * eso esta funcion puede vivir en este modulo puro (sin DOM real) en
 * vez de en `export.ts`/`projectSnapshot.ts`.
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || commaIndex === -1) {
    throw new Error('dataUrlToBytes: no es un data URL valido.');
  }
  const base64 = dataUrl.slice(commaIndex + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Nombre de archivo del ZIP de un proyecto (ticket 044) -- deriva del
 * nombre del proyecto para que descargas de proyectos distintos no se
 * pisen bajo el mismo nombre generico (a diferencia del ZIP de un solo
 * mob del ticket 006, que si tenia un nombre fijo -- ese flujo se
 * retiro en este ticket). Normaliza acentos/mayusculas/caracteres no
 * alfanumericos a un slug legible en cualquier sistema de archivos; un
 * nombre que quede vacio tras normalizar (ej. solo emojis/simbolos) cae
 * a "proyecto" en vez de producir un archivo sin nombre.
 */
export function projectZipFilename(projectName: string): string {
  const slug = projectName
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'proyecto'}-resource-pack.zip`;
}
