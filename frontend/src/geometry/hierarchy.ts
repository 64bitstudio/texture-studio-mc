// Ticket 084 -- jerarquia de huesos (padre-hijo) para el editor de
// modelo 3D. Ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.
//
// DECISION DE DISEÑO (no especificada literalmente por el ticket, pero
// necesaria para que "mover el padre arrastra a la hija" sea real, no
// solo cosmetico): cuando una caja tiene `parentId`, su `position` deja
// de ser absoluta (espacio mundo) y pasa a ser RELATIVA a la posicion
// de su padre -- exactamente el mismo patron ya establecido por
// `pivot`/`rotation` (ticket 024, backend/src/types/baseAssets.ts): una
// caja ya podia posicionarse "relativa a un punto" en vez de
// directamente en el mundo. Esto permite que el visor 3D (ver
// `ModelEditor3D.tsx`) anide un `<group>` de three.js por caja --
// mover/rotar el grupo del padre arrastra automaticamente a los grupos
// hijos anidados adentro, gratis, via el propio scene graph de
// three.js, sin logica adicional de sincronizacion manual.
//
// Deliberadamente puro -- sin React/three.js -- mismo criterio de
// testabilidad que `modelEditing.ts`/`packBoxesUV.ts` (ver
// `frontend/test/hierarchy.spec.ts`).

import type { MobGeometry } from '../types/baseAssets';

/**
 * Posicion ABSOLUTA (espacio mundo) de una caja, resolviendo su cadena
 * completa de padres. Una caja sin `parentId` ya es absoluta (mismo
 * comportamiento que antes de este ticket, sin cambios). Protegida
 * contra ciclos accidentales en los datos (no deberian existir si
 * siempre se pasa por `setParent`, pero un ciclo aca causaria
 * recursion infinita -- se corta con un set de nombres visitados).
 */
export function computeAbsolutePosition(geometry: MobGeometry, name: string, visited: ReadonlySet<string> = new Set()): [number, number, number] {
  const part = geometry.parts[name];
  if (!part) return [0, 0, 0];
  if (!part.parentId || visited.has(name)) return part.position;

  const parentAbsolute = computeAbsolutePosition(geometry, part.parentId, new Set(visited).add(name));
  return [
    parentAbsolute[0] + part.position[0],
    parentAbsolute[1] + part.position[1],
    parentAbsolute[2] + part.position[2],
  ];
}

/** Todas las cajas descendientes (hijas, nietas, ...) de `name`, sin incluir a `name` misma. */
export function getDescendants(geometry: MobGeometry, name: string): Set<string> {
  const result = new Set<string>();
  const stack = [name];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const [partName, part] of Object.entries(geometry.parts)) {
      if (part.parentId === current && !result.has(partName)) {
        result.add(partName);
        stack.push(partName);
      }
    }
  }
  return result;
}

/** `true` si asignar `proposedParentId` como padre de `name` crearia un ciclo (asignarse a si misma, o a una de sus propias descendientes). */
export function wouldCreateCycle(geometry: MobGeometry, name: string, proposedParentId: string): boolean {
  if (proposedParentId === name) return true;
  return getDescendants(geometry, name).has(proposedParentId);
}

export type SetParentResult = { ok: true; geometry: MobGeometry } | { ok: false; error: string };

/**
 * Asigna (o quita, con `parentId: null`) el padre de una caja --
 * validando que no exista ya, y que no se cree un ciclo (HU-3, ultimo
 * criterio de aceptacion: "la app lo rechaza con un mensaje claro").
 * Convierte automaticamente `position` entre absoluta y relativa para
 * que la caja NUNCA salte visualmente al cambiar de padre -- ver
 * comentario del modulo.
 */
export function setParent(geometry: MobGeometry, name: string, parentId: string | null): SetParentResult {
  const part = geometry.parts[name];
  if (!part) {
    return { ok: false, error: `La caja "${name}" no existe.` };
  }
  if (parentId !== null && !(parentId in geometry.parts)) {
    return { ok: false, error: `La caja "${parentId}" no existe.` };
  }
  if (parentId !== null && wouldCreateCycle(geometry, name, parentId)) {
    return { ok: false, error: `"${parentId}" ya es descendiente de "${name}" -- asignarla como padre crearia un ciclo.` };
  }

  const currentAbsolute = computeAbsolutePosition(geometry, name);
  const newPosition: [number, number, number] = parentId
    ? subtract(currentAbsolute, computeAbsolutePosition(geometry, parentId))
    : currentAbsolute;
  const newParentId = parentId === null ? undefined : parentId;

  return {
    ok: true,
    geometry: {
      ...geometry,
      parts: {
        ...geometry.parts,
        [name]: { ...part, parentId: newParentId, position: newPosition },
      },
    },
  };
}

function subtract(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * Jerarquia por defecto de los 4 mobs vainilla (ticket 084, HU-3,
 * segundo criterio de aceptacion) -- derivada de la geometria real
 * (mismos nombres de parte que `backend/src/geometry/*.ts`).
 */
const DEFAULT_HIERARCHY: Record<string, Record<string, string>> = {
  skeleton: { head: 'body', armRight: 'body', armLeft: 'body', legRight: 'body', legLeft: 'body' },
  zombie: { head: 'body', armRight: 'body', armLeft: 'body', legRight: 'body', legLeft: 'body' },
  spider: {
    head: 'thorax',
    abdomen: 'thorax',
    leg1Right: 'thorax',
    leg1Left: 'thorax',
    leg2Right: 'thorax',
    leg2Left: 'thorax',
    leg3Right: 'thorax',
    leg3Left: 'thorax',
    leg4Right: 'thorax',
    leg4Left: 'thorax',
  },
  creeper: { head: 'body', legFrontRight: 'body', legFrontLeft: 'body', legBackRight: 'body', legBackLeft: 'body' },
};

/** Mapa hijo->padre por defecto para un mob vainilla conocido. Vacio (`{}`) para un mobId desconocido -- ninguna jerarquia se impone en ese caso, no un error. */
export function getDefaultParentMap(mobId: string): Readonly<Record<string, string>> {
  return DEFAULT_HIERARCHY[mobId] ?? {};
}

/**
 * Aplica la jerarquia por defecto a una geometria vainilla RECIEN
 * cargada (ninguna caja tiene `parentId` todavia) -- convierte cada
 * hija de absoluta a relativa a su padre via `setParent`. Un `mobId`
 * sin jerarquia conocida, o partes que no coinciden con los nombres
 * esperados (geometria ya editada con nombres distintos), simplemente
 * no agrega esa relacion -- nunca lanza.
 *
 * **Hallazgo real (ticket 090, investigando el visor 3D animado)**: una
 * caja con `pivot` (ticket 024 -- hoy, solo las 8 patas de la Araña)
 * define su `position` como un punto de referencia PRE-rotacion
 * respecto a su propio `pivot` (ver `Viewer3D.tsx`/`geometryBounds.ts`),
 * no como su posicion final en el mundo -- convertirla a "relativa al
 * padre" via `setParent` (que SI trata `position` como si fuera
 * absoluta) corrompe esa referencia y produce una pata mal ubicada. Se
 * excluye deliberadamente a cualquier caja con `pivot` de la jerarquia
 * automatica (se queda sin `parentId`, exactamente como antes de este
 * ticket -- cero cambio de comportamiento para ella) hasta que la
 * matematica de `pivot`+jerarquia se reconcilie explicitamente (fuera
 * de alcance de este ticket, señalado en el "Hecho"). `setParent` en si
 * (la API de bajo nivel que usa el selector "Padre" manual del editor
 * de modelo) NO se toca -- un usuario que asigne un padre a mano a una
 * caja con pivot sigue pudiendo hacerlo, solo que este helper
 * AUTOMATICO ya no se lo impone por default.
 */
export function applyDefaultHierarchy(geometry: MobGeometry, mobId: string): MobGeometry {
  const parentMap = getDefaultParentMap(mobId);
  let result = geometry;
  for (const [childName, parentName] of Object.entries(parentMap)) {
    if (!(childName in result.parts) || !(parentName in result.parts)) continue;
    if (result.parts[childName]?.pivot) continue;
    const outcome = setParent(result, childName, parentName);
    if (outcome.ok) result = outcome.geometry;
  }
  return result;
}

/**
 * `true` si al menos una caja ya tiene `parentId` -- criterio para
 * decidir si hace falta llamar a `applyDefaultHierarchy` (una geometria
 * vainilla recien cargada nunca lo tiene; una ya editada, o ya
 * confirmada con jerarquia, si). `export` desde el ticket 090 --
 * antes vivia privada en `ModelEditor3D.tsx` (ticket 084), ahora la
 * reusa tambien `AnimationEditor.tsx` (mismo criterio "aplicar
 * jerarquia por defecto la primera vez que hace falta").
 */
export function hasAnyHierarchy(geometry: MobGeometry): boolean {
  return Object.values(geometry.parts).some((part) => part.parentId !== undefined);
}
