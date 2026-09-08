// Ticket 088 -- asistencia de IA para geometría (Etapa 1). Ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.
//
// Deliberadamente puro -- sin React/fetch/clipboard -- mismo criterio
// de testabilidad que `modelEditing.ts`/`hierarchy.ts` (ver
// `frontend/test/geometryProposal.spec.ts`). El puente manual y el
// modo automático (tickets 088/091) comparten TODO este módulo: la
// única diferencia entre ambos es de dónde sale el JSON de respuesta
// (copiado/pegado a mano, o la respuesta de `POST /api/ai/propose-*`,
// ticket 087) -- una vez que el JSON llega, se valida y se aplica
// exactamente igual sin importar su origen.

import { GENERIC_FACE_LABELS, PLACEHOLDER_UV } from './modelEditing';
import { wouldCreateCycle } from './hierarchy';
import type { MobGeometry } from '../types/baseAssets';

/** Forma minima que le pedimos a la IA -- SOLO los campos sobre los que puede razonar con sentido (forma/posicion/jerarquia), nunca `uv`/`faceLabels` (eso lo resuelve `packBoxesUV` al confirmar, ticket 086 -- pedirle a la IA que invente coordenadas UV no tiene ningun sentido). */
export interface ProposedBoxPart {
  size: [number, number, number];
  position: [number, number, number];
  parentId?: string | null;
  rotation?: [number, number, number];
}

export interface GeometryProposal {
  parts: Record<string, ProposedBoxPart>;
}

/**
 * Prompt que arma la app para el puente manual (HU-4) -- el MISMO texto
 * se reusa para el modo automático (HU-5, ticket 091), enviado tal cual
 * como `prompt` al endpoint del ticket 087. Serializa la geometria base
 * (solo los campos relevantes -- ver `ProposedBoxPart`) para que la IA
 * tenga contexto de las proporciones/jerarquia ya existentes, en vez de
 * inventar un mob desde cero.
 */
export function buildGeometryProposalPrompt(baseGeometry: MobGeometry, description: string): string {
  const baseParts: Record<string, ProposedBoxPart> = {};
  for (const [name, part] of Object.entries(baseGeometry.parts)) {
    const entry: ProposedBoxPart = { size: part.size, position: part.position, parentId: part.parentId ? part.parentId : null };
    if (part.rotation) entry.rotation = part.rotation;
    baseParts[name] = entry;
  }

  return `Tienes un modelo 3D estilo Minecraft (biped) con esta geometria de partida (cajas con tamaño/posicion/jerarquia padre-hijo, unidades tipo Minecraft):

${JSON.stringify(baseParts, null, 2)}

Modifica esta geometria segun la siguiente descripcion, agregando, quitando o ajustando cajas segun haga falta: "${description}"

Responde SOLO con JSON valido en este formato exacto (sin texto extra), con la geometria FINAL completa (reemplaza a la anterior por completo -- incluye tambien las cajas que no cambiaron):
{
  "parts": {
    "<nombre_de_caja>": {
      "size": [<ancho>, <alto>, <profundidad>],
      "position": [<x>, <y>, <z>],
      "parentId": "<nombre_de_otra_caja_o_null_si_es_raiz>"
    }
  }
}

Cada "parentId" debe ser el nombre de OTRA caja de esta misma respuesta (o null) -- nunca un ciclo (una caja no puede ser, directa ni indirectamente, padre de si misma).`;
}

export type GeometryProposalResult = { ok: true; geometry: MobGeometry } | { ok: false; error: string };

function isFiniteTriplet(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number' && Number.isFinite(n));
}

/**
 * Valida la forma cruda de una propuesta (JSON parseado, de origen no
 * confiable -- pegado a mano o devuelto por la IA) y, si es valida, la
 * aplica sobre `baseGeometry`: la propuesta reemplaza `parts` por
 * completo (no es un merge/parche) -- toda caja que no traiga uv/
 * faceLabels propios (nueva, o ya existente pero sin ellos en la
 * propuesta) recibe el mismo placeholder que usa `modelEditing.addBox`;
 * una caja que YA existia en `baseGeometry` conserva su `uv`/
 * `faceLabels` reales si la propuesta no los toca (nunca los pierde por
 * el simple hecho de haber pasado por una propuesta de IA).
 */
export function validateAndApplyGeometryProposal(raw: unknown, baseGeometry: MobGeometry): GeometryProposalResult {
  if (typeof raw !== 'object' || raw === null || !('parts' in raw)) {
    return { ok: false, error: 'La respuesta no tiene la forma esperada: falta el campo "parts".' };
  }
  const parts = (raw as { parts: unknown }).parts;
  if (typeof parts !== 'object' || parts === null || Array.isArray(parts) || Object.keys(parts).length === 0) {
    return { ok: false, error: '"parts" debe ser un objeto no vacio de cajas.' };
  }

  const proposedNames = new Set(Object.keys(parts));
  const proposedParts: Record<string, ProposedBoxPart> = {};

  for (const [name, rawPart] of Object.entries(parts as Record<string, unknown>)) {
    if (typeof rawPart !== 'object' || rawPart === null) {
      return { ok: false, error: `La caja "${name}" no es un objeto valido.` };
    }
    const { size, position, parentId, rotation } = rawPart as Record<string, unknown>;

    if (!isFiniteTriplet(size) || size.some((n) => n <= 0)) {
      return { ok: false, error: `La caja "${name}" tiene un "size" invalido (deben ser 3 numeros positivos).` };
    }
    if (!isFiniteTriplet(position)) {
      return { ok: false, error: `La caja "${name}" tiene un "position" invalido (deben ser 3 numeros).` };
    }
    if (parentId !== undefined && parentId !== null && typeof parentId !== 'string') {
      return { ok: false, error: `La caja "${name}" tiene un "parentId" invalido (debe ser texto o null).` };
    }
    if (typeof parentId === 'string' && !proposedNames.has(parentId)) {
      return { ok: false, error: `La caja "${name}" declara como padre a "${parentId}", que no existe en la propuesta.` };
    }
    if (rotation !== undefined && !isFiniteTriplet(rotation)) {
      return { ok: false, error: `La caja "${name}" tiene un "rotation" invalido (deben ser 3 numeros).` };
    }

    const entry: ProposedBoxPart = { size, position, parentId: typeof parentId === 'string' ? parentId : null };
    if (rotation) entry.rotation = rotation as [number, number, number];
    proposedParts[name] = entry;
  }

  // Ciclos: se arma una geometria temporal SOLO para reusar `wouldCreateCycle`
  // (misma logica ya validada en `hierarchy.spec.ts`) en vez de reimplementar
  // deteccion de ciclos por segunda vez.
  const tempParts: MobGeometry['parts'] = {};
  for (const [name, p] of Object.entries(proposedParts)) {
    tempParts[name] = {
      size: p.size,
      position: p.position,
      uv: PLACEHOLDER_UV,
      faceLabels: GENERIC_FACE_LABELS,
      parentId: p.parentId ? p.parentId : undefined,
    };
  }
  const tempGeometry: MobGeometry = { textureWidth: baseGeometry.textureWidth, textureHeight: baseGeometry.textureHeight, parts: tempParts };

  for (const [name, part] of Object.entries(proposedParts)) {
    if (part.parentId && wouldCreateCycle(tempGeometry, name, part.parentId)) {
      return { ok: false, error: `"${name}" y "${part.parentId}" forman un ciclo de jerarquia -- revisa los "parentId" de la propuesta.` };
    }
  }

  const finalParts: MobGeometry['parts'] = {};
  for (const [name, proposed] of Object.entries(proposedParts)) {
    const existing = baseGeometry.parts[name];
    finalParts[name] = {
      size: proposed.size,
      position: proposed.position,
      parentId: proposed.parentId ? proposed.parentId : undefined,
      rotation: proposed.rotation,
      uv: existing ? existing.uv : PLACEHOLDER_UV,
      faceLabels: existing ? existing.faceLabels : GENERIC_FACE_LABELS,
    };
  }

  return {
    ok: true,
    geometry: { textureWidth: baseGeometry.textureWidth, textureHeight: baseGeometry.textureHeight, parts: finalParts },
  };
}
