// Puente entre los buffers en memoria del ticket 018 (`bufferCache` de
// `App.tsx`) y el formato puro de `projectStorage.ts` (ticket 019).
// Depende de APIs exclusivas del navegador (`<canvas>`/`FileReader` via
// `encodeBufferToPngBlob`, `Image` via `decodePngDataUrlToImageData`) --
// deliberadamente separado de `projectStorage.ts` (puro, testeable sin
// DOM) por el mismo criterio ya establecido en el proyecto entre
// `decodeTexture.ts`/`export.ts` (DOM) y `textureBuffer.ts`/
// `exportPack.ts` (puros). Sin tests unitarios dedicados -- mockear
// canvas/Image/FileReader para esto es mas ruido que valor dado su
// tamaño (mismo criterio ya aplicado a `export.ts`/`decodeTexture.ts`);
// se valida con la revision en vivo del checklist de cierre (getImageData
// real antes/despues de guardar+recargar).

import { encodeBufferToPngBlob } from './export';
import { decodePngDataUrlToImageData } from './decodeTexture';
import { computeUVBoxRects } from './symmetry';
import { clampResolutionMultiplier } from './resolution';
import { TextureBuffer } from './textureBuffer';
import type { MobGeometry } from './types/baseAssets';
import type { ProjectMobEntry } from './projectStorage';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo codificar el PNG a base64.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Arma el `mobs` que espera `saveProject`, a partir de TODOS los mobs
 * presentes en `bufferCache` que tengan su geometria ya conocida en
 * `geometryCache` -- ambos Maps son responsabilidad de quien llama
 * (ticket 045: ya NO hay un `bufferCache`/`geometryCache` compartido de
 * sesion completa en `App.tsx`; `NuevoProyecto.tsx`/`AgregarMobs.tsx`,
 * tickets 038/042, construyen Maps LOCALES con solo los mobs que
 * corresponde guardar en ese momento). Se puebla `geometryCache` en el
 * mismo momento en que `GET /api/base-assets/:mobId` responde para ese
 * mob, siempre ANTES de que se escriba el buffer correspondiente en
 * `bufferCache` -- invariante que debe mantener quien construya ambos
 * Maps: todo mob presente en `bufferCache` debe tener su entrada en
 * `geometryCache`.
 *
 * MASKING ticket 015 (`maskPixelsOutsideUVBoxes`, via
 * `encodeBufferToPngBlob` -- reusada tal cual, sin duplicar la logica de
 * codificacion PNG): un proyecto guardado se codifica con la MISMA
 * limpieza que ya aplica la exportacion -- cualquier pixel fuera de las
 * cajas UV conocidas (ej. la caja "hat" del layout clasico, 100%
 * decorativa/sin uso real en el modelo) se guarda como alpha=0, igual
 * que en un export. Consecuencia documentada (ver
 * docs/ARQUITECTURA.md, "Ticket 019"): si el usuario pinto algo fuera de
 * esas zonas, ese contenido NO sobrevive un ciclo de guardar+cargar
 * (aunque si sigue visible mientras no recargue/reabra el proyecto) --
 * exactamente la misma perdida que ya aceptaba un export antes de este
 * ticket, ahora tambien aplicada al guardado para que "guardar y luego
 * exportar" y "exportar directo" produzcan siempre el mismo resultado.
 *
 * La resolucion de trabajo de cada mob se DERIVA de las dimensiones
 * reales del buffer (`buffer.width / geometry.textureWidth`) -- no hay
 * un estado de "resolucion actual" separado por mob fuera de `Editor`
 * (ver `docs/ARQUITECTURA.md`, "Ticket 018"/"Ticket 019"): el buffer
 * SIEMPRE tiene exactamente `nativeWidth * resolucion` de ancho, es la
 * misma tecnica que el fix de `Editor.tsx` usa para reconstruir el
 * `resolution` inicial al remontar desde un buffer cacheado.
 */
export async function buildProjectSnapshot(
  bufferCache: Map<string, TextureBuffer>,
  geometryCache: Map<string, MobGeometry>,
): Promise<Record<string, ProjectMobEntry>> {
  const mobs: Record<string, ProjectMobEntry> = {};

  for (const [mobId, buffer] of bufferCache.entries()) {
    const geometry = geometryCache.get(mobId);
    if (!geometry) {
      // Defensivo (ver doc de arriba: no deberia ocurrir en la
      // practica) -- nunca aborta el guardado completo por un mob sin
      // geometria conocida, pero tampoco lo incluye con datos
      // incompletos/incorrectos.
      console.warn(`projectSnapshot: se omite el mob "${mobId}" al guardar -- no se conoce su geometria en esta sesion.`);
      continue;
    }

    const resolution = clampResolutionMultiplier(buffer.width / geometry.textureWidth);
    const uvBoxes = computeUVBoxRects(geometry, resolution);
    const pngBlob = await encodeBufferToPngBlob(buffer, uvBoxes);
    const pngDataUrl = await blobToDataUrl(pngBlob);
    mobs[mobId] = { resolution, pngDataUrl };
  }

  return mobs;
}

/**
 * Reconstruye un `TextureBuffer` por mob a partir de un `ProjectRecord`
 * ya cargado (`loadProject`, ticket 019). Decodifica cada PNG a su
 * resolucion NATURAL (sin forzar `width`/`height` -- ver
 * `decodeTexture.ts`, extension de este ticket): el PNG guardado YA
 * mide exactamente `nativeWidth*resolucion x nativeHeight*resolucion`
 * (es el mismo buffer codificado tal cual, ver `buildProjectSnapshot`),
 * asi que no hace falta volver a pedirle al backend la geometria de
 * CADA mob del proyecto solo para saber sus dimensiones nativas -- el
 * propio PNG ya las contiene. El `resolution` guardado en el registro no
 * se usa aca (es informativo/parte del formato documentado) porque las
 * dimensiones reales se derivan directo del PNG decodificado, no
 * recalculandolas desde `resolution * nativeWidth`.
 */
/**
 * Arma el `ProjectMobEntry` de un mob recién CONFIRMADO (ticket 086,
 * cierre de la Etapa 2) -- `geometry` ya viene con el atlas UV aplicado
 * (`confirmModelGeometry`, `packBoxesUV.ts`). El PNG es un lienzo en
 * blanco/transparente del tamaño exacto del atlas: la Etapa 3 (pintar)
 * arranca desde cero sobre esa geometría, no hay textura previa que
 * conservar (a diferencia de un mob vainilla, que sí trae su textura
 * real del catálogo). `encodeBufferToPngBlob(buffer, [])` -- sin cajas
 * UV que enmascarar -- es un no-op sobre un buffer que ya es 100%
 * transparente, se reusa en vez de escribir un segundo camino de
 * codificación PNG solo para este caso.
 */
export async function buildConfirmedMobEntry(geometry: MobGeometry): Promise<ProjectMobEntry> {
  const buffer = new TextureBuffer(geometry.textureWidth, geometry.textureHeight);
  const pngBlob = await encodeBufferToPngBlob(buffer, []);
  const pngDataUrl = await blobToDataUrl(pngBlob);
  return { resolution: 1, pngDataUrl, geometryStatus: 'confirmado', customGeometry: geometry };
}

export async function restoreProjectBuffers(mobs: Record<string, ProjectMobEntry>): Promise<Map<string, TextureBuffer>> {
  const restored = new Map<string, TextureBuffer>();

  for (const [mobId, entry] of Object.entries(mobs)) {
    const imageData = await decodePngDataUrlToImageData(entry.pngDataUrl);
    restored.set(mobId, new TextureBuffer(imageData.width, imageData.height, imageData.data));
  }

  return restored;
}
