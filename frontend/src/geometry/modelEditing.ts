// Ticket 083 -- edicion manual de geometria (Etapa 1 del epic de
// modelado 3D, ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md).
// Deliberadamente puro -- sin React/three.js -- mismo criterio de
// testabilidad que `packBoxesUV.ts`/`geometryBounds.ts` (ver
// `frontend/test/modelEditing.spec.ts`).

import type { FaceLabels, MobBoxPart, MobGeometry } from '../types/baseAssets';
import { computeGeometryBounds } from './geometryBounds';

/** Tamaño por defecto de una caja recien agregada -- pequeña, facil de ver y de ajustar a mano. */
export const DEFAULT_NEW_BOX_SIZE: [number, number, number] = [4, 4, 4];

/** Sin lateralidad ni nombre de parte especifico -- una caja agregada a mano no tiene todavia una region UV "real" (eso lo resuelve `packBoxesUV` al confirmar el modelo, ticket 086), asi que sus etiquetas de cara son genericas. */
const GENERIC_FACE_LABELS: FaceLabels = {
  front: 'Frente',
  back: 'Atrás',
  top: 'Arriba',
  bottom: 'Abajo',
  left: 'Izquierda',
  right: 'Derecha',
};

/** UV placeholder -- una caja nueva no tiene region propia hasta que `packBoxesUV` (ticket 086) le asigne una real; el tipo `MobBoxPart.uv` es requerido, asi que necesita ALGUN valor mientras tanto. */
const PLACEHOLDER_UV = { x: 0, y: 0 };

/** Primer nombre libre de la forma "cajaN" dentro de `geometry.parts` -- determinista, nunca colisiona con partes ya existentes (vainilla o agregadas antes). */
export function generateNewPartName(geometry: MobGeometry): string {
  let n = 1;
  while (`caja${n}` in geometry.parts) {
    n += 1;
  }
  return `caja${n}`;
}

/**
 * Posicion por defecto para una caja nueva de tamaño `size`, que no se
 * superponga con ninguna caja existente: se coloca junto (+x, con
 * margen) al bounding box combinado actual, a media altura de ese
 * bounding box. Sin cajas existentes (geometria vacia), se coloca sobre
 * el piso en el origen.
 */
export function findNonOverlappingPosition(geometry: MobGeometry, size: [number, number, number]): [number, number, number] {
  const bounds = computeGeometryBounds(geometry);
  if (!bounds) {
    return [0, size[1] / 2, 0];
  }
  const MARGIN = 2;
  const x = bounds.max[0] + MARGIN + size[0] / 2;
  const y = (bounds.min[1] + bounds.max[1]) / 2;
  return [x, y, 0];
}

/** Agrega una caja nueva a `geometry`, con nombre/posicion generados automaticamente. Devuelve la geometria resultante Y el nombre asignado (para que quien llama pueda seleccionarla de inmediato). */
export function addBox(
  geometry: MobGeometry,
  size: [number, number, number] = DEFAULT_NEW_BOX_SIZE,
): { geometry: MobGeometry; name: string } {
  const name = generateNewPartName(geometry);
  const position = findNonOverlappingPosition(geometry, size);
  const part: MobBoxPart = { size, position, uv: PLACEHOLDER_UV, faceLabels: GENERIC_FACE_LABELS };
  return { geometry: { ...geometry, parts: { ...geometry.parts, [name]: part } }, name };
}

/** Elimina una caja de `geometry` por nombre. No-op seguro (devuelve la misma geometria) si el nombre no existe. */
export function removeBox(geometry: MobGeometry, name: string): MobGeometry {
  if (!(name in geometry.parts)) return geometry;
  const parts = Object.fromEntries(Object.entries(geometry.parts).filter(([key]) => key !== name));
  return { ...geometry, parts };
}

/** Actualiza posicion/tamaño/rotacion de UNA caja -- usado por los 3 modos del gizmo (mover/escalar/rotar). No-op seguro si el nombre no existe. */
export function updateBoxTransform(
  geometry: MobGeometry,
  name: string,
  update: Partial<Pick<MobBoxPart, 'position' | 'size' | 'rotation'>>,
): MobGeometry {
  const existing = geometry.parts[name];
  if (!existing) return geometry;
  return { ...geometry, parts: { ...geometry.parts, [name]: { ...existing, ...update } } };
}

/**
 * Una caja solo se puede eliminar si NO es parte de la geometria
 * vainilla original con la que arrancó el editor (ticket 083, HU-2:
 * "elimino una caja que no es parte de la geometría vainilla
 * original"). `originalPartNames` se captura UNA vez al abrir el editor
 * (ver el componente `ModelEditor3D`) -- cajas agregadas durante la
 * sesión de edición siempre son eliminables.
 */
export function canDeleteBox(name: string, originalPartNames: ReadonlySet<string>): boolean {
  return !originalPartNames.has(name);
}
