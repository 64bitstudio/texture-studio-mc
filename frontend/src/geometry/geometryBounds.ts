import type { MobGeometry } from '../types/baseAssets';

// Centro del bounding box 3D de un `MobGeometry` (ticket 020, hallazgo
// durante la implementacion de la Araña -- ver docs/ARQUITECTURA.md,
// "Ticket 020"). Antes de este ticket, `Viewer3D.tsx` apuntaba el
// `target` de `OrbitControls` a un valor fijo `[0, 16, 0]` -- correcto
// SOLO por coincidencia para el biped clasico (Esqueleto/Zombie), cuyo
// bounding box real (pies en y=0, cabeza hasta y=32) tiene centro
// exactamente en y=16. La Araña, mucho mas pequeña y centrada en otra
// altura/profundidad (cuerpo en y=5..13, z=-11..15), quedaria mirando a
// un punto muy alejado de su propio modelo con ese valor fijo.
//
// Deliberadamente puro -- sin React/three.js -- mismo criterio de
// testabilidad que `symmetry.ts`/`regionLabels.ts` (ver
// `frontend/test/geometryBounds.spec.ts`). Verificado que para
// SKELETON_GEOMETRY/ZOMBIE_GEOMETRY esta funcion devuelve exactamente
// `[0, 16, 0]` -- mismo resultado que el valor fijo anterior, sin
// regresion visual para los mobs ya existentes.
export function computeGeometryCenter(geometry: MobGeometry): [number, number, number] {
  const parts = Object.values(geometry.parts);
  if (parts.length === 0) return [0, 0, 0];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const part of parts) {
    const [w, h, d] = part.size;
    const [x, y, z] = part.position;
    minX = Math.min(minX, x - w / 2);
    maxX = Math.max(maxX, x + w / 2);
    minY = Math.min(minY, y - h / 2);
    maxY = Math.max(maxY, y + h / 2);
    minZ = Math.min(minZ, z - d / 2);
    maxZ = Math.max(maxZ, z + d / 2);
  }

  return [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
}
