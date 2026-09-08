// Exportacion 100% cliente (ticket 006, HU-10/HU-11): sin round-trip al
// backend, ver docs/definiciones/editor-3d-texturas-esqueleto.md y
// docs/ARQUITECTURA.md. Depende de APIs exclusivas del navegador
// (`<canvas>`, `canvas.toBlob`, `URL.createObjectURL`, `<a download>`)
// y de `JSZip` -- deliberadamente separado de `exportPack.ts` (que es
// puro y testeable sin DOM), mismo criterio ya establecido por
// `decodeTexture.ts` frente a `textureBuffer.ts`/`importImage.ts`. Sin
// tests unitarios dedicados (mockear canvas/JSZip/descarga para esto es
// mas ruido que valor dado su tamaño) -- se valida con revision visual
// en vivo (ver checklist de cierre del ticket).

import JSZip from 'jszip';
import type { TextureBuffer } from './textureBuffer';
import { buildResourcePackFiles, DEFAULT_PACK_DESCRIPTION, dataUrlToBytes, projectZipFilename } from './exportPack';
import { blockbenchModelFileName, buildBlockbenchModel } from './exportBlockbench';
import { applyDefaultHierarchy, hasAnyHierarchy } from './geometry/hierarchy';
import type { UVBoxRect } from './symmetry';
import { maskPixelsOutsideUVBoxes } from './uvBoxCleanup';
import type { ProjectMobEntry } from './projectStorage';
import type { MobGeometry } from './types/baseAssets';

/** Nombre de archivo fijo pedido por el ticket (HU-10). */
export const EXPORTED_PNG_FILENAME = 'skeleton.png';

/**
 * Codifica el contenido ACTUAL del `TextureBuffer` (unica fuente de
 * verdad -- ticket 006, item 4: no importa si vino de pintar a mano, de
 * importar o de pegar una imagen, ver HU-12) como PNG real, via un
 * `<canvas>` offscreen + `canvas.toBlob`. Usada por `exportTexturePng`
 * (HU-10, unico export de un solo mob que sigue vivo) y tambien por
 * `buildProjectSnapshot` (`projectSnapshot.ts`) al guardar un proyecto
 * -- el ZIP de proyecto (ticket 044, `exportProjectZip`) YA NO llama a
 * esta funcion directamente: reusa el PNG guardado tal cual via
 * `dataUrlToBytes` (`exportPack.ts`), sin volver a codificar.
 *
 * MITIGACION ticket 015 (bug critico "hat overlay contaminado en
 * export"): antes de volcar los pixeles al canvas, se pasan por
 * `maskPixelsOutsideUVBoxes` (`uvBoxCleanup.ts`), que fuerza
 * `alpha=0` en todo pixel fuera de `uvBoxes` -- la caja "hat" del
 * modelo real (y cualquier otro hueco del layout clasico 64x32) NUNCA
 * llega opaca al PNG exportado, sin importar que haya en el buffer en
 * ese momento ni por que camino llego ahi. `uvBoxes` debe venir YA
 * escalado a la resolucion de trabajo activa (`computeUVBoxRects(geometry,
 * resolution)`, ver `Editor.tsx`) -- esta funcion no lo recalcula, para
 * no duplicar esa logica (ver ticket). Esto NUNCA muta `buffer`: opera
 * sobre una copia (`maskPixelsOutsideUVBoxes` siempre devuelve datos
 * nuevos), asi que el usuario sigue editando el contenido real
 * (incluida cualquier zona fuera de las cajas) sin que la exportacion
 * se lo borre.
 */
export function encodeBufferToPngBlob(buffer: TextureBuffer, uvBoxes: UVBoxRect[]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('No se pudo obtener el contexto 2D del canvas de exportacion.'));
      return;
    }
    const cleaned = maskPixelsOutsideUVBoxes({ width: buffer.width, height: buffer.height, data: buffer.getRawData() }, uvBoxes);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(cleaned.data), cleaned.width, cleaned.height), 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No se pudo generar el PNG de la textura.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

/** Dispara la descarga de un `Blob` con el nombre dado, sin navegar la pagina actual. */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exporta el PNG suelto de la textura (HU-10): descarga `skeleton.png`
 * con los pixeles actuales del buffer, alpha incluido -- fuera de
 * `uvBoxes` siempre en alpha=0 (ticket 015, ver `encodeBufferToPngBlob`).
 */
export async function exportTexturePng(buffer: TextureBuffer, uvBoxes: UVBoxRect[]): Promise<void> {
  const blob = await encodeBufferToPngBlob(buffer, uvBoxes);
  triggerBlobDownload(blob, EXPORTED_PNG_FILENAME);
}

/**
 * Exporta el ZIP completo de un PROYECTO (ticket 044, HU-4) -- itera
 * TODOS los mobs guardados del proyecto activo (`ProjectRecord.mobs`,
 * ver `projectStorage.ts`) y arma un unico resource pack con la
 * textura de cada uno en su ruta vanilla real
 * (`buildResourcePackFiles`, ahora generalizada a N mobs). REEMPLAZA a
 * la exportacion anterior de "solo el mob activo del editor"
 * (`exportResourcePackZip`, ticket 006/HU-11, retirada en este ticket
 * -- ver `docs/ARQUITECTURA.md`, "Ticket 044"): esa opcion ya no existe
 * en ningun lado de la UI, esta es la unica forma de exportar un ZIP.
 *
 * Cada `pngDataUrl` guardado YA es el PNG final, limpio de zonas fuera
 * de `uvBoxes` (`maskPixelsOutsideUVBoxes` corrio una vez al guardar,
 * ver `buildProjectSnapshot`) -- se decodifica a bytes crudos con
 * `dataUrlToBytes` (sin canvas/Image, ver esa funcion) en vez de volver
 * a decodificar a pixeles y re-codificar a PNG, que seria trabajo
 * redundante y un segundo lugar donde el masking podria desalinearse.
 *
 * Lanza si el proyecto no tiene ningun mob -- un ZIP vacio (solo
 * `pack.mcmeta`, sin ninguna textura) no es un resource pack util y no
 * deberia poder dispararse desde la UI (el boton solo aparece en la
 * vista de detalle de un proyecto que, por construccion, siempre tiene
 * al menos un mob desde que se creo con "Nuevo proyecto").
 */
export async function exportProjectZip(
  projectName: string,
  mobs: Record<string, ProjectMobEntry>,
  description: string = DEFAULT_PACK_DESCRIPTION,
): Promise<void> {
  const entries = Object.entries(mobs);
  if (entries.length === 0) {
    throw new Error(`El proyecto "${projectName}" no tiene ningun mob que exportar.`);
  }

  const mobInputs = entries.map(([mobId, entry]) => ({ mobId, pngBytes: dataUrlToBytes(entry.pngDataUrl) }));

  const zip = new JSZip();
  for (const file of buildResourcePackFiles(mobInputs, description)) {
    zip.file(file.path, file.data);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(zipBlob, projectZipFilename(projectName));
}

/**
 * Exporta un `.bbmodel` (Blockbench) de UN mob -- ticket 092, geometría +
 * jerarquía + textura ya pintada; ticket 093, animaciones nombradas ya
 * creadas en el editor de animación (`entry.animations`, opcional --
 * un mob sin ninguna sigue exportando igual, con `animations: []`).
 * Disponible para CUALQUIER mob (vainilla o custom, confirmado o no) --
 * mismo criterio ya establecido por `AnimationEditor.tsx` (ticket 090):
 * si la geometría todavía no tiene jerarquía de huesos, se le aplica la
 * jerarquía por defecto de `mobId` antes de exportar, para que el
 * `outliner` del archivo SIEMPRE refleje una jerarquía real (nunca N
 * cajas sueltas sin padre).
 *
 * `entry.pngDataUrl` ya es el PNG final (limpio de zonas fuera de las
 * cajas UV, ver `buildProjectSnapshot`) -- se embebe tal cual en
 * `textures[0].source`, mismo criterio que `exportProjectZip`.
 */
export async function exportMobBlockbench(mobId: string, geometry: MobGeometry, entry: Pick<ProjectMobEntry, 'pngDataUrl' | 'animations'>): Promise<void> {
  const hierarchicalGeometry = hasAnyHierarchy(geometry) ? geometry : applyDefaultHierarchy(geometry, mobId);
  const model = buildBlockbenchModel(hierarchicalGeometry, {
    modelName: mobId,
    textureFileName: `${mobId}.png`,
    textureDataUrl: entry.pngDataUrl,
    animations: entry.animations,
  });
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
  triggerBlobDownload(blob, blockbenchModelFileName(mobId));
}
