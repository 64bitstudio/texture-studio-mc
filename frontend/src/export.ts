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
import { buildResourcePackFiles, DEFAULT_PACK_DESCRIPTION } from './exportPack';
import type { UVBoxRect } from './symmetry';
import { maskPixelsOutsideUVBoxes } from './uvBoxCleanup';

/** Nombre de archivo fijo pedido por el ticket (HU-10). */
export const EXPORTED_PNG_FILENAME = 'skeleton.png';

/** Nombre de archivo del ZIP -- ver diagrama de secuencia en docs/definiciones/editor-3d-texturas-esqueleto.md. */
export const EXPORTED_ZIP_FILENAME = 'resource-pack.zip';

/**
 * Codifica el contenido ACTUAL del `TextureBuffer` (unica fuente de
 * verdad -- ticket 006, item 4: no importa si vino de pintar a mano, de
 * importar o de pegar una imagen, ver HU-12) como PNG real, via un
 * `<canvas>` offscreen + `canvas.toBlob`. Reutilizada tanto por
 * `exportTexturePng` (HU-10) como por `exportResourcePackZip` (HU-11)
 * para no duplicar la logica de codificacion en dos lugares.
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
 * Exporta el ZIP completo del resource pack (HU-11): codifica la
 * textura actual a PNG (limpia de zonas fuera de `uvBoxes`, ticket
 * 015), arma `pack.mcmeta` + `skeleton.png` en la estructura de
 * carpetas correcta (`buildResourcePackFiles`, logica pura) y descarga
 * el `.zip` resultante.
 */
export async function exportResourcePackZip(
  buffer: TextureBuffer,
  uvBoxes: UVBoxRect[],
  description: string = DEFAULT_PACK_DESCRIPTION,
): Promise<void> {
  const pngBlob = await encodeBufferToPngBlob(buffer, uvBoxes);
  const pngBytes = await pngBlob.arrayBuffer();

  const zip = new JSZip();
  for (const file of buildResourcePackFiles(pngBytes, description)) {
    zip.file(file.path, file.data);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(zipBlob, EXPORTED_ZIP_FILENAME);
}
