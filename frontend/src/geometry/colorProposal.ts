// Ticket 089 -- asistencia de IA para color (Etapa 3, HU-8). Ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.
//
// Deliberadamente puro -- sin React/DOM/three.js -- mismo criterio de
// testabilidad que `geometryProposal.ts` (ticket 088). Mismo diseño de
// fondo: la IA no "pinta" pixeles directamente (pedirle coordenadas de
// pixel individuales a un LLM no tiene sentido) -- propone un color hex
// plano por CARA de cada parte (front/back/top/bottom/left/right,
// mismas claves que `BoxFaceRects`), y este módulo rasteriza esa
// propuesta sobre el atlas real usando `computeBoxFaceRects` (única
// fuente de verdad de "qué pixeles pertenecen a qué cara de qué caja",
// ya usada por `applyBoxUV.ts`/`regionLabels.ts`). Es explícitamente
// una "primera pasada" (HU-8) -- color sólido por cara, sin degradados
// ni detalle -- el usuario sigue pintando encima con las herramientas
// existentes.

import { computeBoxFaceRects, type BoxFaceRects } from './applyBoxUV';
import { groupPartsBySharedUV } from './packBoxesUV';
import type { MobGeometry } from '../types/baseAssets';
import type { PixelSource } from '../textureBuffer';

export type FaceKey = keyof BoxFaceRects;

const FACE_KEYS: FaceKey[] = ['front', 'back', 'top', 'bottom', 'left', 'right'];

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Un color hex opaco (`#RRGGBB`) por cara que la IA decide pintar -- omitir una cara la deja sin tocar (no todas las partes/caras necesitan cubrirse en una "primera pasada"). */
export type ProposedPartColors = Partial<Record<FaceKey, string>>;

export interface ColorProposal {
  parts: Record<string, ProposedPartColors>;
}

/**
 * Prompt que arma la app para el puente manual (HU-8) -- el MISMO texto
 * se reusa para el modo automático (mismo criterio que
 * `buildGeometryProposalPrompt`, ticket 088). Lista una sola parte por
 * grupo de UV compartido (`groupPartsBySharedUV`, ticket 085) con sus
 * `faceLabels` legibles -- pedirle a la IA un color para `armLeft`
 * además de `armRight` sería redundante (misma región de pixeles).
 */
export function buildColorProposalPrompt(geometry: MobGeometry, description: string): string {
  const groups = groupPartsBySharedUV(geometry.parts);
  const partsForPrompt: Record<string, { caras: Record<FaceKey, string> }> = {};
  for (const { members } of groups.values()) {
    const representativeName = members[0]!;
    const part = geometry.parts[representativeName]!;
    partsForPrompt[representativeName] = { caras: part.faceLabels };
  }

  return `Tienes un modelo 3D estilo Minecraft con estas partes y sus caras (nombre de parte -> etiqueta legible de cada cara):

${JSON.stringify(partsForPrompt, null, 2)}

Propon una primera pasada de color para lograr este estilo: "${description}"

Responde SOLO con JSON valido en este formato exacto (sin texto extra), un color hexadecimal opaco de 6 digitos por cada cara que quieras pintar (podés omitir partes o caras completas si preferis dejarlas sin pintar -- no hace falta cubrir las 6 caras de cada parte):
{
  "parts": {
    "<nombre_de_parte>": {
      "front": "#RRGGBB",
      "back": "#RRGGBB",
      "top": "#RRGGBB",
      "bottom": "#RRGGBB",
      "left": "#RRGGBB",
      "right": "#RRGGBB"
    }
  }
}

Usa EXACTAMENTE esos 6 nombres de cara en ingles (front/back/top/bottom/left/right), nunca la etiqueta legible que se te mostro arriba -- esa etiqueta es solo para que entiendas que representa cada cara.`;
}

export type ColorProposalResult = { ok: true; pixels: PixelSource } | { ok: false; error: string };

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

function fillRect(data: Uint8ClampedArray, width: number, height: number, rect: { x0: number; y0: number; x1: number; y1: number }, r: number, g: number, b: number): void {
  const x0 = Math.max(0, rect.x0);
  const y0 = Math.max(0, rect.y0);
  const x1 = Math.min(width, rect.x1);
  const y1 = Math.min(height, rect.y1);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * width + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
}

/**
 * Valida la forma cruda de una propuesta de color (JSON parseado, de
 * origen no confiable) contra `geometry`, y si es válida, la rasteriza
 * sobre una COPIA de `currentPixels` (nunca la muta) -- quien llama
 * decide qué hacer con el resultado (ver `computeFullReplaceDiff` en
 * `importImage.ts`, mismo mecanismo ya usado por "Importar imagen"
 * para convertir un reemplazo completo del buffer en una sola unidad
 * de undo).
 *
 * A diferencia de `validateAndApplyGeometryProposal` (ticket 088), acá
 * SÍ se rechaza una parte que no existe en `geometry.parts` -- una
 * propuesta de color no tiene sentido para una caja inventada (nunca
 * agrega cajas, sólo las colorea).
 *
 * `scale` (default 1, mismo criterio que `computeUVBoxRects` en
 * `symmetry.ts`): la geometría describe el UV en pixeles NATIVOS -- si
 * `currentPixels` viene de un `TextureBuffer` a una resolución de
 * trabajo mayor (ticket 009), hay que escalar el rectángulo de cada
 * cara antes de rellenarlo.
 */
export function validateAndApplyColorProposal(raw: unknown, geometry: MobGeometry, currentPixels: PixelSource, scale = 1): ColorProposalResult {
  if (typeof raw !== 'object' || raw === null || !('parts' in raw)) {
    return { ok: false, error: 'La respuesta no tiene la forma esperada: falta el campo "parts".' };
  }
  const parts = (raw as { parts: unknown }).parts;
  if (typeof parts !== 'object' || parts === null || Array.isArray(parts) || Object.keys(parts).length === 0) {
    return { ok: false, error: '"parts" debe ser un objeto no vacío de partes.' };
  }

  const validatedParts: Record<string, ProposedPartColors> = {};
  let coveredFaceCount = 0;

  for (const [name, rawFaces] of Object.entries(parts as Record<string, unknown>)) {
    if (!(name in geometry.parts)) {
      return { ok: false, error: `La parte "${name}" no existe en este modelo -- una propuesta de color no puede inventar partes nuevas.` };
    }
    if (typeof rawFaces !== 'object' || rawFaces === null || Array.isArray(rawFaces)) {
      return { ok: false, error: `Las caras de "${name}" no son un objeto válido.` };
    }

    const faces: ProposedPartColors = {};
    for (const [faceKey, value] of Object.entries(rawFaces as Record<string, unknown>)) {
      if (!FACE_KEYS.includes(faceKey as FaceKey)) {
        return { ok: false, error: `"${name}" declara una cara desconocida ("${faceKey}") -- las únicas válidas son front/back/top/bottom/left/right.` };
      }
      if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
        return { ok: false, error: `"${name}.${faceKey}" no es un color hexadecimal válido (se espera "#RRGGBB").` };
      }
      faces[faceKey as FaceKey] = value;
      coveredFaceCount += 1;
    }
    validatedParts[name] = faces;
  }

  if (coveredFaceCount === 0) {
    return { ok: false, error: 'La propuesta no coloreó ninguna cara.' };
  }

  const data = new Uint8ClampedArray(currentPixels.data);
  for (const [name, faces] of Object.entries(validatedParts)) {
    const part = geometry.parts[name]!;
    const [w, h, d] = part.size;
    const rects = computeBoxFaceRects(part.uv.x * scale, part.uv.y * scale, w * scale, h * scale, d * scale);
    for (const faceKey of FACE_KEYS) {
      const hex = faces[faceKey];
      if (!hex) continue;
      const { r, g, b } = hexToRgb(hex);
      fillRect(data, currentPixels.width, currentPixels.height, rects[faceKey], r, g, b);
    }
  }

  return { ok: true, pixels: { width: currentPixels.width, height: currentPixels.height, data } };
}
