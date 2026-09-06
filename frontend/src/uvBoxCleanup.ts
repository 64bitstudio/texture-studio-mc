// Limpieza de pixeles fuera de las cajas UV conocidas (ticket 015 --
// bug critico "hat overlay contaminado en export"). Logica PURA -- sin
// React/DOM/three.js/canvas, mismo criterio de testabilidad que
// `textureBuffer.ts`/`symmetry.ts`/`importImage.ts`/`resolution.ts`
// (ver `frontend/test/uvBoxCleanup.spec.ts`).
//
// DIAGNOSTICO (ya hecho por el orquestador, ver
// `pending/015-bug-hat-overlay-contaminado-en-export.md` -- no
// repetido aca): el modelo real del Esqueleto incluye una septima caja
// "hat" (overlay del casco, UV `(32,0)-(64,16)` en 64x32 nativo) que
// este proyecto deliberadamente NO modela como parte pintable (no
// aparece en `SKELETON_GEOMETRY`/`computeUVBoxRects`) porque en el
// asset vanilla real es 100% transparente. Junto con esa caja, el
// layout clasico 64x32 tiene otros huecos sin uso real (~45% del
// lienzo nativo). Cualquier contenido OPACO que termine en esas zonas
// -- sin importar como llego ahi -- se renderiza encima de la cabeza
// real en un cliente Minecraft real (la caja "hat" esta inflada sobre
// la cabeza), tapandola por completo.
//
// FIX (Parte A del ticket, obligatoria): en vez de intentar bloquear
// cada camino posible por el que pixeles opacos puedan colarse a esas
// zonas (pintado a mano, importar, pegar, cambios de resolucion,
// futuros caminos aun no escritos), se garantiza el resultado final
// de forma estructural -- CUALQUIER pixel que no caiga dentro de
// ninguna caja UV conocida se fuerza a alpha=0 en el momento de
// exportar (`export.ts`), sin importar que haya en el buffer. Esto no
// modifica el buffer real que el usuario sigue editando (ver
// `maskPixelsOutsideUVBoxes`, que siempre devuelve una copia nueva) ni
// bloquea pintar ahi (fuera del alcance de este ticket, ver "Que NO
// hacer" en el ticket).

import { findContainingBox, type UVBoxRect } from './symmetry';
import type { PixelSource } from './textureBuffer';

/**
 * Indica si `(x,y)` cae dentro de alguna de las cajas UV conocidas.
 * Envoltorio trivial sobre `findContainingBox` (ya validado por
 * `symmetry.spec.ts`) para no repetir el chequeo de pertenencia --
 * ver comentario de modulo.
 */
export function isInsideAnyUVBox(x: number, y: number, boxes: UVBoxRect[]): boolean {
  return findContainingBox({ x, y }, boxes) !== null;
}

/**
 * Devuelve una copia NUEVA de `source` (mismo `width`/`height`) con
 * `alpha = 0` forzado en todo pixel fuera de `boxes`, dejando el resto
 * (RGB y RGBA de los pixeles SI cubiertos por alguna caja) exactamente
 * igual -- nunca muta `source.data` in-place, para que el llamador
 * pueda aplicar esto a una copia de solo-exportacion sin tocar el
 * `TextureBuffer` real que el usuario sigue editando (ver `export.ts`)
 * ni el contenido de una imagen recien importada antes de fusionarla
 * (ver `Editor.tsx`, `handleImportFile`).
 */
export function maskPixelsOutsideUVBoxes(source: PixelSource, boxes: UVBoxRect[]): PixelSource {
  const data = new Uint8ClampedArray(source.data);

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (isInsideAnyUVBox(x, y, boxes)) continue;
      const alphaIndex = (y * source.width + x) * 4 + 3;
      data[alphaIndex] = 0;
    }
  }

  return { width: source.width, height: source.height, data };
}
