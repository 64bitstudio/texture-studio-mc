import { roundBoxSize } from './modelEditing';
import type { BoxUvOrigin, MobBoxPart, MobGeometry } from '../types/baseAssets';

/**
 * Empaquetado UV genérico para geometría CUSTOM (ticket 085 -- pieza
 * central de la Etapa 2, ver docs/definiciones/
 * modelado-3d-custom-y-generacion-con-ia.md).
 *
 * Los 4 mobs vainilla (`backend/src/geometry/*.ts`) NUNCA pasan por
 * aquí -- siguen usando su `uv` fijo de siempre, sin tocar. Este
 * empaquetador es exclusivo de los modelos que se crean en el editor de
 * modelo (Etapa 1): ahí no hay un layout hand-tuned de Mojang que
 * replicar, solo un conjunto arbitrario de cajas que necesita un atlas
 * de textura sin traslapes.
 *
 * Algoritmo: "shelf packing" clásico -- ordena los footprints (el
 * rectángulo "cross" completo de cada caja, mismo cálculo que ya usa
 * `computeBoxFaceRects`: ancho `2d+2w`, alto `d+h`) de más alto a más
 * bajo, y los acomoda en filas de ancho `maxWidth`, abriendo una fila
 * nueva cuando la actual ya no tiene espacio. Simple, determinista, y
 * suficientemente compacto para la cantidad moderada de cajas esperada
 * -- no persigue el empaquetado óptimo (bin packing es NP-difícil en
 * general), y el diseño ya asume que el usuario ve y pinta sobre el
 * resultado antes de exportar (ver "Riesgos" del documento de
 * definición).
 */

export interface PackedUVAtlas {
  textureWidth: number;
  textureHeight: number;
  /** Origen UV asignado a CADA caja de entrada (una entrada por nombre de parte, ya resuelto el dedupe por `group`). */
  origins: Record<string, BoxUvOrigin>;
}

/** Ancho por defecto del atlas -- mismo ancho que usan los 4 mobs vainilla (`textureWidth: 64` en todos), para que el resultado se sienta como una textura de Minecraft normal salvo que una sola caja sea más ancha que eso. */
export const DEFAULT_ATLAS_MAX_WIDTH = 64;

type PackableParts = Record<string, Pick<MobBoxPart, 'size' | 'group'>>;

/**
 * Agrupa las partes de entrada por `group` (mismo campo que ya usa
 * `regionLabels.ts` para dedupe de regiones idénticas -- ej. las 8
 * patas de la Araña, o `armRight`/`armLeft` del biped clásico). Partes
 * sin `group` son su propio grupo (una región UV propia). Cajas del
 * mismo grupo comparten UN solo origen -- mismo ahorro de espacio que
 * ya usa el formato vainilla.
 *
 * `export` desde el ticket 089 -- `geometry/colorProposal.ts` la reusa
 * para no pedirle a la IA un color por cada parte de un grupo (ej.
 * `armRight`/`armLeft`) cuando comparten exactamente la misma región de
 * pixeles.
 */
export function groupPartsBySharedUV(parts: PackableParts): Map<string, { size: [number, number, number]; members: string[] }> {
  const groups = new Map<string, { size: [number, number, number]; members: string[] }>();
  for (const [name, part] of Object.entries(parts)) {
    const key = part.group ?? name;
    const existing = groups.get(key);
    if (existing) {
      existing.members.push(name);
    } else {
      groups.set(key, { size: part.size, members: [name] });
    }
  }
  return groups;
}

/**
 * Calcula un atlas UV para un conjunto arbitrario de cajas, sin
 * traslapes entre ellas. Ver comentario del módulo para el criterio de
 * agrupamiento (`group`) y el algoritmo (shelf packing).
 *
 * Sin cajas de entrada, devuelve un atlas de tamaño 0x0 sin origenes --
 * caso borde que no debería ocurrir en la práctica (`ticket 086`: "un
 * modelo con al menos una caja"), pero no lanza.
 */
export function packBoxesUV(parts: PackableParts, maxWidth: number = DEFAULT_ATLAS_MAX_WIDTH): PackedUVAtlas {
  const groups = groupPartsBySharedUV(parts);

  const items = Array.from(groups.entries()).map(([key, { size, members }]) => {
    const [w, h, d] = size;
    return { key, members, footprintWidth: 2 * d + 2 * w, footprintHeight: d + h };
  });

  if (items.length === 0) {
    return { textureWidth: 0, textureHeight: 0, origins: {} };
  }

  // De mas alto a mas bajo -- heuristica estandar de shelf packing,
  // minimiza el espacio vertical desperdiciado en cada fila.
  items.sort((a, b) => b.footprintHeight - a.footprintHeight);

  // Una sola caja mas ancha que `maxWidth` no debe truncarse ni
  // provocar un bucle infinito -- el atlas simplemente crece para
  // acomodarla (su propia fila).
  const effectiveWidth = Math.max(maxWidth, ...items.map((item) => item.footprintWidth));

  const origins: Record<string, BoxUvOrigin> = {};
  let shelfY = 0;
  let cursorX = 0;
  let shelfHeight = 0;
  let atlasWidth = 0;

  for (const item of items) {
    if (cursorX > 0 && cursorX + item.footprintWidth > effectiveWidth) {
      shelfY += shelfHeight;
      cursorX = 0;
      shelfHeight = 0;
    }

    const origin: BoxUvOrigin = { x: cursorX, y: shelfY };
    for (const memberName of item.members) {
      origins[memberName] = origin;
    }

    cursorX += item.footprintWidth;
    shelfHeight = Math.max(shelfHeight, item.footprintHeight);
    atlasWidth = Math.max(atlasWidth, cursorX);
  }

  return { textureWidth: atlasWidth, textureHeight: shelfY + shelfHeight, origins };
}

/**
 * Aplica un atlas ya calculado (`packBoxesUV`) a una geometría --
 * reemplaza `textureWidth`/`textureHeight` por las del atlas, y el `uv`
 * de cada caja por el origen que le asignó el empaquetado. Una caja sin
 * origen asignado (no debería ocurrir si el atlas se calculó a partir
 * de la misma `geometry`) conserva su `uv` anterior en vez de perderlo.
 */
export function applyPackedAtlas(geometry: MobGeometry, atlas: PackedUVAtlas): MobGeometry {
  const parts = Object.fromEntries(
    Object.entries(geometry.parts).map(([name, part]) => [name, { ...part, uv: atlas.origins[name] ?? part.uv }]),
  );
  return { textureWidth: atlas.textureWidth, textureHeight: atlas.textureHeight, parts };
}

/**
 * Cierra la Etapa 2 (ticket 086, HU-6): empaqueta y aplica el atlas UV
 * de una sola vez, a partir de la geometría final del editor de modelo.
 *
 * Redondea el `size` de CADA caja a enteros (`roundBoxSize`) antes de
 * empaquetar -- defensa final, y la que de verdad importa: aunque
 * `ModelEditor3D`/`geometryProposal.ts` ya redondean en sus propios
 * puntos de entrada (arrastre del gizmo, propuesta de IA), esta es la
 * unica que tambien protege geometria YA GUARDADA con tamaños
 * fraccionarios de una sesion anterior a ese fix (hallazgo real de
 * Marco: "confirmar modelo no hace nada" -- ver `roundBoxSize` en
 * `modelEditing.ts` para la causa raiz completa). Sin este redondeo, un
 * footprint fraccionario (`2d+2w`/`d+h`) produce un atlas
 * (`textureWidth`/`textureHeight`) fraccionario, y `new ImageData(...)`
 * (`export.ts`) revienta con "input data length is not a multiple of 4"
 * -- silenciosamente, porque `handleConfirmModel` (App.tsx) descarta la
 * promesa con `void`.
 */
export function confirmModelGeometry(geometry: MobGeometry, maxWidth: number = DEFAULT_ATLAS_MAX_WIDTH): MobGeometry {
  const roundedParts = Object.fromEntries(
    Object.entries(geometry.parts).map(([name, part]) => [name, { ...part, size: roundBoxSize(part.size) }]),
  );
  const roundedGeometry: MobGeometry = { ...geometry, parts: roundedParts };
  return applyPackedAtlas(roundedGeometry, packBoxesUV(roundedGeometry.parts, maxWidth));
}
