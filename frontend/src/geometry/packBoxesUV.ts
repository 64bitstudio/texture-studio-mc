import type { BoxUvOrigin, MobBoxPart } from '../types/baseAssets';

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
 */
function groupPartsBySharedUV(parts: PackableParts): Map<string, { size: [number, number, number]; members: string[] }> {
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
