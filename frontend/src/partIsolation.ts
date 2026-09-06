// Aislar una parte para pintar (ticket 012 -- feedback directo de
// Marco, ver `pending/012-aislar-parte-para-pintar.md`). Deliberadamente
// puro -- sin React/DOM/three.js -- mismo criterio de testabilidad que
// `symmetry.ts`/`regionLabels.ts` (ver
// `frontend/test/partIsolation.spec.ts`).
//
// DECISION DE GRANULARIDAD (no estaba especificada literalmente por el
// ticket, ver docs/ARQUITECTURA.md "Ticket 012"): "una parte" se aisla a
// nivel de REGION individual del catalogo de `regionLabels.ts` (una sola
// cara de una caja, ej. `head.front` = "Cara"), no a nivel de caja
// completa (`groupKey` = "head"). El propio ejemplo del ticket ("la
// cara") es precisamente una region de ese tamaño -- aislar la caja
// COMPLETA de la cabeza (las 6 caras) seguiria dejando visible/pintable
// la nuca, los lados, etc., sin reducir el riesgo de "pintar la caja
// equivocada" al nivel que pide el objetivo del ticket. Por eso este
// modulo reusa `NamedUVRegion` (una region = un rectangulo) tal cual,
// sin introducir un segundo nivel de agrupacion propio.
//
// Este modulo es el punto UNICO de acceso a "pertenece o no a la parte
// aislada" -- la MISMA funcion se usa para (a) atenuar visualmente el
// resto de la cuadricula (`TextureEditor.tsx`, canvas de dim) y (b)
// bloquear el pintado fuera de la region activa (`Editor.tsx`,
// `applyPixelsWithSymmetry`) -- exactamente el patron que pide la
// seccion de verificacion del ticket ("función que determina si un
// pixel (x,y) pertenece a la región activa, usada tanto para el
// atenuado visual como para bloquear el pintado").

import type { NamedUVRegion } from './regionLabels';
import type { PixelPoint } from './textureBuffer';

/**
 * `true` si `point` pertenece a la parte actualmente aislada.
 *
 * `activeRegion === null` significa "sin aislamiento activo" (modo
 * "Mostrar todo") -- en ese caso CUALQUIER pixel es valido, por lo que
 * siempre devuelve `true`. Con una region activa, delega en el mismo
 * chequeo semiabierto `[x0,x1) x [y0,y1)` que ya usa
 * `findRegionAtPixel` (`regionLabels.ts`), para no introducir una
 * segunda formula de "contencion en rectangulo".
 */
export function isPixelInActiveRegion(point: PixelPoint, activeRegion: NamedUVRegion | null): boolean {
  if (!activeRegion) return true;
  const { rect } = activeRegion;
  return point.x >= rect.x0 && point.x < rect.x1 && point.y >= rect.y0 && point.y < rect.y1;
}

/**
 * Filtra `points` a los que pertenecen a `activeRegion` -- azucar sobre
 * `isPixelInActiveRegion` para el caso de uso de `Editor.tsx`
 * (`applyPixelsWithSymmetry`): un trazo/linea completo puede tener
 * puntos primarios y espejados (simetria, ticket 004), y con
 * aislamiento activo solo deben escribirse los que caen dentro de la
 * parte aislada -- el resto se descarta en silencio, MISMO criterio ya
 * establecido por `mirrorPointHorizontal` (`symmetry.ts`) al descartar
 * puntos sin contraparte valida (zonas de relleno), no una inconsistencia
 * nueva de este ticket (ver docs/ARQUITECTURA.md, "Ticket 012").
 *
 * Si `activeRegion` es `null`, devuelve `points` sin modificar (sin
 * aislamiento activo, nada que filtrar).
 */
export function filterPointsToActiveRegion(points: PixelPoint[], activeRegion: NamedUVRegion | null): PixelPoint[] {
  if (!activeRegion) return points;
  return points.filter((p) => isPixelInActiveRegion(p, activeRegion));
}

/**
 * Nombre legible de grupo (`groupKey` de `regionLabels.ts`) para agrupar
 * las regiones del selector de partes en `<optgroup>` (ticket 012,
 * "Selector de partes"). Puramente de PRESENTACION -- no interviene en
 * ningun calculo de pixeles ni de geometria (esas siguen siendo
 * responsabilidad exclusiva de `regionLabels.ts`). Los 4 grupos del
 * Esqueleto ya conocidos (`groupKey` viene de `part.group` en cada
 * `MobBoxPart`, ver `backend/src/types/baseAssets.ts`, ticket 020)
 * tienen nombre fijo; cualquier `groupKey` futuro no listado cae al
 * propio valor capitalizado en vez de romper (defensivo ante un mob
 * futuro con partes nuevas, sin necesidad de tocar este archivo primero).
 */
const GROUP_DISPLAY_LABELS: Record<string, string> = {
  head: 'Cabeza',
  body: 'Torso',
  arm: 'Brazo',
  leg: 'Pierna',
  // Ticket 020 (Araña) -- grupos propios de una anatomia no-biped. `leg`
  // arriba sigue siendo "Pierna" (biped) porque `spiderLeg` es una clave
  // DISTINTA (nunca colisionan) -- las 8 patas de la Araña comparten esta,
  // no la de arriba.
  thorax: 'Tórax',
  abdomen: 'Abdomen',
  spiderLeg: 'Pata',
};

export function groupDisplayLabel(groupKey: string): string {
  return GROUP_DISPLAY_LABELS[groupKey] ?? groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
}
