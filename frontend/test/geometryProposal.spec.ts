// Ticket 088 -- asistencia de IA para geometría (validación + aplicación
// de una propuesta). Ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.

import { describe, expect, it } from 'vitest';
import { buildGeometryProposalPrompt, validateAndApplyGeometryProposal } from '../src/geometry/geometryProposal';
import type { FaceLabels, MobGeometry } from '../src/types/baseAssets';

const REAL_LABELS: FaceLabels = { front: 'Frente', back: 'Atrás', top: 'Arriba', bottom: 'Abajo', left: 'Izquierda', right: 'Derecha' };

const BASE_GEOMETRY: MobGeometry = {
  textureWidth: 64,
  textureHeight: 32,
  parts: {
    body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 16, y: 16 }, faceLabels: REAL_LABELS },
    head: { size: [8, 8, 8], position: [0, 10, 0], parentId: 'body', uv: { x: 0, y: 0 }, faceLabels: REAL_LABELS },
  },
};

describe('buildGeometryProposalPrompt', () => {
  it('incluye la descripcion del usuario y la geometria base serializada', () => {
    const prompt = buildGeometryProposalPrompt(BASE_GEOMETRY, 'hazlo mas musculoso');
    expect(prompt).toContain('hazlo mas musculoso');
    expect(prompt).toContain('"body"');
    expect(prompt).toContain('"parentId"');
  });

  it('serializa parentId como null para una caja raiz (no "undefined")', () => {
    const prompt = buildGeometryProposalPrompt(BASE_GEOMETRY, 'x');
    const parsed = JSON.parse(prompt.match(/\{[\s\S]*?\n\}/)![0]) as Record<string, { parentId: string | null }>;
    expect(parsed.body!.parentId).toBeNull();
    expect(parsed.head!.parentId).toBe('body');
  });
});

describe('validateAndApplyGeometryProposal -- rechazos', () => {
  it('rechaza una respuesta que no es un objeto', () => {
    const result = validateAndApplyGeometryProposal('esto no es un objeto', BASE_GEOMETRY);
    expect(result.ok).toBe(false);
  });

  it('rechaza si falta "parts"', () => {
    const result = validateAndApplyGeometryProposal({ algoDistinto: true }, BASE_GEOMETRY);
    expect(result.ok).toBe(false);
  });

  it('rechaza "parts" vacio', () => {
    const result = validateAndApplyGeometryProposal({ parts: {} }, BASE_GEOMETRY);
    expect(result.ok).toBe(false);
  });

  it('rechaza una caja con "size" invalido (no 3 numeros positivos)', () => {
    const result = validateAndApplyGeometryProposal({ parts: { body: { size: [8, 12], position: [0, 0, 0] } } }, BASE_GEOMETRY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/size/);
  });

  it('rechaza "size" con un numero negativo o cero', () => {
    const result = validateAndApplyGeometryProposal({ parts: { body: { size: [8, 0, 4], position: [0, 0, 0] } } }, BASE_GEOMETRY);
    expect(result.ok).toBe(false);
  });

  it('rechaza un "parentId" que no existe en la propuesta', () => {
    const result = validateAndApplyGeometryProposal(
      { parts: { body: { size: [8, 12, 4], position: [0, 0, 0], parentId: 'fantasma' } } },
      BASE_GEOMETRY,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/fantasma/);
  });

  it('rechaza un ciclo de jerarquia con un mensaje claro', () => {
    const result = validateAndApplyGeometryProposal(
      {
        parts: {
          body: { size: [8, 12, 4], position: [0, 0, 0], parentId: 'head' },
          head: { size: [8, 8, 8], position: [0, 10, 0], parentId: 'body' },
        },
      },
      BASE_GEOMETRY,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ciclo/);
  });
});

describe('validateAndApplyGeometryProposal -- aceptacion', () => {
  it('aplica una propuesta valida, preservando uv/faceLabels de cajas ya existentes', () => {
    const result = validateAndApplyGeometryProposal(
      {
        parts: {
          body: { size: [10, 14, 5], position: [0, 20, 0], parentId: null },
          head: { size: [8, 8, 8], position: [0, 12, 0], parentId: 'body' },
          casco: { size: [9, 2, 9], position: [0, 4, 0], parentId: 'head' },
        },
      },
      BASE_GEOMETRY,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.geometry.parts.body!.size).toEqual([10, 14, 5]);
    expect(result.geometry.parts.body!.uv).toEqual(BASE_GEOMETRY.parts.body!.uv);
    expect(result.geometry.parts.head!.faceLabels).toEqual(BASE_GEOMETRY.parts.head!.faceLabels);
    // "casco" es una caja NUEVA -- recibe placeholder, no rompe el tipo.
    expect(result.geometry.parts.casco!.parentId).toBe('head');
    expect(result.geometry.parts.casco!.uv).toBeDefined();
  });

  it('una caja de la geometria base OMITIDA en la propuesta desaparece (reemplazo completo, no merge)', () => {
    const result = validateAndApplyGeometryProposal({ parts: { body: { size: [8, 12, 4], position: [0, 18, 0], parentId: null } } }, BASE_GEOMETRY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.geometry.parts.head).toBeUndefined();
  });

  // Hallazgo real de Marco ("confirmar modelo no hace nada"): la IA a
  // veces propone tamaños fraccionarios (detalle fino, ej. un jiron de
  // tela) -- un `size` fraccionario rompe el atlas UV al confirmar el
  // modelo (ver `roundBoxSize` en `modelEditing.ts`). Se redondea ACA,
  // al validar la propuesta, para que "Cajas del modelo" ya muestre el
  // tamaño real que se va a confirmar.
  it('redondea un "size" fraccionario a enteros (evita el bug de "confirmar modelo no hace nada")', () => {
    const result = validateAndApplyGeometryProposal(
      { parts: { body: { size: [8, 12, 4], position: [0, 18, 0], parentId: null }, jiron: { size: [1.25, 4.6, 0.3], position: [0, 20, 2], parentId: 'body' } } },
      BASE_GEOMETRY,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.geometry.parts.jiron!.size).toEqual([1, 5, 1]);
  });

  it('conserva textureWidth/textureHeight de la geometria base (el atlas real se calcula al confirmar, ticket 086)', () => {
    const result = validateAndApplyGeometryProposal({ parts: { body: { size: [8, 12, 4], position: [0, 0, 0], parentId: null } } }, BASE_GEOMETRY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.geometry.textureWidth).toBe(BASE_GEOMETRY.textureWidth);
    expect(result.geometry.textureHeight).toBe(BASE_GEOMETRY.textureHeight);
  });

  it('acepta rotation opcional', () => {
    const result = validateAndApplyGeometryProposal(
      { parts: { body: { size: [8, 12, 4], position: [0, 0, 0], parentId: null, rotation: [0, 45, 0] } } },
      BASE_GEOMETRY,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.geometry.parts.body!.rotation).toEqual([0, 45, 0]);
  });
});
