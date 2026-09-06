// Catalogo de regiones UV nombradas (ticket 011 -- feedback directo de
// Marco, ver `pending/011-regiones-uv-nombradas.md`). Deliberadamente
// puro -- sin React/DOM/three.js -- mismo criterio de testabilidad que
// `textureBuffer.ts`/`symmetry.ts` (ver
// `frontend/test/regionLabels.spec.ts`).
//
// Reusabilidad para el ticket 012 (aislar parte para pintar, que
// depende de este): este modulo es el punto UNICO de acceso al
// catalogo de nombres -- `computeNamedRegions` deriva las regiones a
// partir de la geometria servida por el backend (fuente de verdad, ver
// `backend/src/geometry/skeletonGeometry.ts`) y de
// `computeBoxFaceRects` (ya usada por `applyBoxUV.ts` para el render
// 3D, misma formula, sin duplicar el calculo). El ticket 012 puede
// importar `computeNamedRegions`/`findRegionAtPixel`/`NamedUVRegion`
// tal cual, sin tener que redefinir el catalogo.

import { computeBoxFaceRects, type PixelRect } from './geometry/applyBoxUV';
import type { PixelPoint } from './textureBuffer';
import type { SkeletonGeometry } from './types/baseAssets';

/** Claves de las 6 caras de una caja -- mismos nombres que ya usa `applyBoxUV.ts`/`FaceLabels`. */
export type BoxFaceKey = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right';

const FACE_KEYS: BoxFaceKey[] = ['front', 'back', 'top', 'bottom', 'left', 'right'];

/**
 * Agrupador de partes que comparten el MISMO rectangulo UV (ticket 009:
 * `armRight`/`armLeft` y `legRight`/`legLeft` apuntan al mismo `uv` y
 * tamaño -- ver `docs/ARQUITECTURA.md`, "Mapeo UV de cajas"). Se usa
 * para generar un `id` estable por region que no duplique entradas
 * identicas entre el lado derecho/izquierdo de brazo y pierna.
 */
const PART_GROUP_KEY: Record<keyof SkeletonGeometry['parts'], string> = {
  head: 'head',
  body: 'body',
  armRight: 'arm',
  armLeft: 'arm',
  legRight: 'leg',
  legLeft: 'leg',
};

/** Una region nombrada del "cross" UV: un rectangulo de pixeles + su nombre legible. */
export interface NamedUVRegion {
  /** Id estable, ej. `"head.front"`/`"arm.left"` -- deduplicado entre partes que comparten UV (ver `PART_GROUP_KEY`). */
  id: string;
  /** Grupo de la parte (`head`/`body`/`arm`/`leg`) -- util para el ticket 012 (aislar por parte). */
  groupKey: string;
  /** Cara dentro de la caja (`front`/`back`/`top`/`bottom`/`left`/`right`). */
  face: BoxFaceKey;
  /** Nombre legible (es-MX), tal como lo sirve el backend en `faceLabels`. */
  label: string;
  /** Rectangulo de pixeles de textura, semiabierto: [x0,x1) x [y0,y1), ya escalado por `scale`. */
  rect: PixelRect;
}

function scaleRect(rect: PixelRect, scale: number): PixelRect {
  return { x0: rect.x0 * scale, y0: rect.y0 * scale, x1: rect.x1 * scale, y1: rect.y1 * scale };
}

/**
 * Deriva el catalogo completo de regiones UV nombradas a partir de la
 * geometria servida por el backend. Deduplica regiones que comparten
 * exactamente el mismo `id` (mismo grupo + misma cara) -- ocurre para
 * `armRight`/`armLeft` y `legRight`/`legLeft`, que comparten region UV
 * (ver `PART_GROUP_KEY`) y, por diseño, tambien el mismo `faceLabels`
 * (sin lateralidad -- ver docs/ARQUITECTURA.md, "Ticket 011").
 *
 * `scale` (igual criterio que `computeUVBoxRects` en `symmetry.ts`,
 * ticket 009): la geometria del backend describe el UV en pixeles
 * NATIVOS (x1) -- a una resolucion de trabajo mayor, los rectangulos
 * deben escalarse proporcionalmente para corresponder a las
 * coordenadas reales del `TextureBuffer` activo.
 */
export function computeNamedRegions(geometry: SkeletonGeometry, scale: number = 1): NamedUVRegion[] {
  const seen = new Set<string>();
  const regions: NamedUVRegion[] = [];

  (Object.keys(geometry.parts) as Array<keyof SkeletonGeometry['parts']>).forEach((partKey) => {
    const part = geometry.parts[partKey];
    const [w, h, d] = part.size;
    const faceRects = computeBoxFaceRects(part.uv.x, part.uv.y, w, h, d);
    const groupKey = PART_GROUP_KEY[partKey];

    FACE_KEYS.forEach((face) => {
      const id = `${groupKey}.${face}`;
      if (seen.has(id)) return;
      seen.add(id);
      regions.push({
        id,
        groupKey,
        face,
        label: part.faceLabels[face],
        rect: scaleRect(faceRects[face], scale),
      });
    });
  });

  return regions;
}

/**
 * Encuentra la region nombrada que contiene el pixel `point`, o `null`
 * si cae fuera de las 4 cajas UV conocidas (zonas de relleno del
 * layout clasico 64x32 -- ver `docs/ARQUITECTURA.md`, "Simetria de
 * pintura", misma nocion de "hueco real del formato" documentada ahi).
 *
 * Recorre `regions` en orden -- no hay solapamiento real entre
 * rectangulos de un mismo catalogo (cada pixel de una caja UV
 * pertenece exactamente a una de sus 6 caras), asi que el primer match
 * es siempre el unico posible.
 */
export function findRegionAtPixel(x: number, y: number, regions: NamedUVRegion[]): NamedUVRegion | null {
  for (const region of regions) {
    const { rect } = region;
    if (x >= rect.x0 && x < rect.x1 && y >= rect.y0 && y < rect.y1) {
      return region;
    }
  }
  return null;
}

/** Azucar sobre `findRegionAtPixel` para un `PixelPoint` -- conveniencia de llamado desde `Editor.tsx`. */
export function findRegionAt(point: PixelPoint, regions: NamedUVRegion[]): NamedUVRegion | null {
  return findRegionAtPixel(point.x, point.y, regions);
}
