// Ticket 089 -- asistencia de IA para color (rasterizar una propuesta
// de colores por cara sobre el atlas real). Ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.

import { describe, expect, it } from 'vitest';
import { buildColorProposalPrompt, validateAndApplyColorProposal } from '../src/geometry/colorProposal';
import { computeBoxFaceRects } from '../src/geometry/applyBoxUV';
import type { FaceLabels, MobGeometry } from '../src/types/baseAssets';

const LABELS: FaceLabels = { front: 'Frente', back: 'Atrás', top: 'Arriba', bottom: 'Abajo', left: 'Izquierda', right: 'Derecha' };

// Geometria sintetica pequeña: "body" (raiz) y dos brazos que
// comparten el MISMO origen UV via `group` (mismo criterio que
// armRight/armLeft del biped clasico) -- ejercita el dedupe del
// prompt.
const GEOMETRY: MobGeometry = {
  textureWidth: 32,
  textureHeight: 32,
  parts: {
    body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 0, y: 0 }, faceLabels: LABELS },
    armRight: { size: [4, 12, 4], position: [-6, 8, 0], uv: { x: 16, y: 0 }, faceLabels: LABELS, group: 'arms' },
    armLeft: { size: [4, 12, 4], position: [6, 8, 0], uv: { x: 16, y: 0 }, faceLabels: LABELS, group: 'arms' },
  },
};

function blankPixels(width: number, height: number) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

describe('buildColorProposalPrompt', () => {
  it('incluye la descripcion y las partes, dedupeando por group', () => {
    const prompt = buildColorProposalPrompt(GEOMETRY, 'piel verde podrida');
    expect(prompt).toContain('piel verde podrida');
    expect(prompt).toContain('"body"');
    // Solo UNA de armRight/armLeft debe aparecer (comparten group).
    const mentionsArmRight = prompt.includes('"armRight"');
    const mentionsArmLeft = prompt.includes('"armLeft"');
    expect(mentionsArmRight !== mentionsArmLeft).toBe(true);
  });

  it('usa las etiquetas legibles de faceLabels, no las claves en ingles, como contexto', () => {
    const prompt = buildColorProposalPrompt(GEOMETRY, 'x');
    expect(prompt).toContain('Frente');
  });

  // Hallazgo real de Marco: para partes CUSTOM (nombre y faceLabels
  // genericos, ej. "caja1" agregada en el editor de modelo) la IA no
  // tenia como inferir que representan -- results "muy basicos". Fix:
  // el prompt ahora incluye tamaño/posicion/jerarquia.
  it('incluye size y position (absoluta) de cada parte, para que la IA pueda inferir que representa una caja custom sin nombre descriptivo', () => {
    const geometryWithCustomBox: MobGeometry = {
      ...GEOMETRY,
      parts: {
        ...GEOMETRY.parts,
        caja1: { size: [1, 4, 1], position: [0, 5, -2], parentId: 'body', uv: { x: 0, y: 24 }, faceLabels: LABELS },
      },
    };
    const prompt = buildColorProposalPrompt(geometryWithCustomBox, 'x');
    const parsed = JSON.parse(prompt.match(/\{[\s\S]*?\n\}/)![0]) as Record<string, { size: number[]; position: number[]; hijaDe?: string }>;
    expect(parsed.caja1!.size).toEqual([1, 4, 1]);
    // position.y de "caja1" es relativa a "body" ([0,18,0]) -> absoluta [0,23,-2].
    expect(parsed.caja1!.position).toEqual([0, 23, -2]);
    expect(parsed.caja1!.hijaDe).toBe('body');
  });

  it('una parte raiz (sin parentId) no trae "hijaDe"', () => {
    const prompt = buildColorProposalPrompt(GEOMETRY, 'x');
    const parsed = JSON.parse(prompt.match(/\{[\s\S]*?\n\}/)![0]) as Record<string, { hijaDe?: string }>;
    expect(parsed.body!.hijaDe).toBeUndefined();
  });

  it('explica al modelo que los nombres genericos (cajaN) no tienen significado predefinido y hay que inferirlo', () => {
    const prompt = buildColorProposalPrompt(GEOMETRY, 'x');
    expect(prompt).toContain('caja1, caja2');
    expect(prompt.toLowerCase()).toContain('infiere');
  });
});

describe('validateAndApplyColorProposal -- rechazos', () => {
  it('rechaza una respuesta que no es un objeto', () => {
    const result = validateAndApplyColorProposal('no es json', GEOMETRY, blankPixels(32, 32));
    expect(result.ok).toBe(false);
  });

  it('rechaza si falta "parts"', () => {
    const result = validateAndApplyColorProposal({}, GEOMETRY, blankPixels(32, 32));
    expect(result.ok).toBe(false);
  });

  it('rechaza "parts" vacio', () => {
    const result = validateAndApplyColorProposal({ parts: {} }, GEOMETRY, blankPixels(32, 32));
    expect(result.ok).toBe(false);
  });

  it('rechaza una parte que no existe en la geometria', () => {
    const result = validateAndApplyColorProposal({ parts: { fantasma: { front: '#ff0000' } } }, GEOMETRY, blankPixels(32, 32));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/fantasma/);
  });

  it('rechaza una cara desconocida', () => {
    const result = validateAndApplyColorProposal({ parts: { body: { arriba: '#ff0000' } } }, GEOMETRY, blankPixels(32, 32));
    expect(result.ok).toBe(false);
  });

  it('rechaza un color que no es hex valido', () => {
    const result = validateAndApplyColorProposal({ parts: { body: { front: 'verde' } } }, GEOMETRY, blankPixels(32, 32));
    expect(result.ok).toBe(false);
  });

  it('rechaza un hex de 3 digitos (solo se acepta el formato largo #RRGGBB)', () => {
    const result = validateAndApplyColorProposal({ parts: { body: { front: '#f00' } } }, GEOMETRY, blankPixels(32, 32));
    expect(result.ok).toBe(false);
  });

  it('rechaza una propuesta que no cubre ninguna cara', () => {
    const result = validateAndApplyColorProposal({ parts: { body: {} } }, GEOMETRY, blankPixels(32, 32));
    expect(result.ok).toBe(false);
  });
});

describe('validateAndApplyColorProposal -- aplicacion', () => {
  it('rellena exactamente los pixeles de la cara indicada, sin tocar el resto', () => {
    const result = validateAndApplyColorProposal({ parts: { body: { front: '#00ff00' } } }, GEOMETRY, blankPixels(32, 32));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const part = GEOMETRY.parts.body!;
    const [w, h, d] = part.size;
    const rects = computeBoxFaceRects(part.uv.x, part.uv.y, w, h, d);

    // Un pixel dentro de la cara "front" -> verde.
    const insideOffset = ((rects.front.y0 + 1) * 32 + (rects.front.x0 + 1)) * 4;
    expect([result.pixels.data[insideOffset], result.pixels.data[insideOffset + 1], result.pixels.data[insideOffset + 2], result.pixels.data[insideOffset + 3]]).toEqual([0, 255, 0, 255]);

    // Un pixel de la cara "top" (no coloreada) -> sigue en blanco/transparente.
    const outsideOffset = ((rects.top.y0 + 1) * 32 + (rects.top.x0 + 1)) * 4;
    expect(result.pixels.data[outsideOffset + 3]).toBe(0);
  });

  it('no muta el PixelSource de entrada (devuelve una copia)', () => {
    const current = blankPixels(32, 32);
    const result = validateAndApplyColorProposal({ parts: { body: { front: '#00ff00' } } }, GEOMETRY, current);
    expect(result.ok).toBe(true);
    expect(current.data.some((v) => v !== 0)).toBe(false);
  });

  it('colorear un miembro de un group (armRight) tambien pinta los pixeles de su group-mate (armLeft), porque comparten la misma region UV', () => {
    const result = validateAndApplyColorProposal({ parts: { armRight: { front: '#0000ff' } } }, GEOMETRY, blankPixels(32, 32));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const part = GEOMETRY.parts.armLeft!; // mismo uv que armRight
    const [w, h, d] = part.size;
    const rects = computeBoxFaceRects(part.uv.x, part.uv.y, w, h, d);
    const offset = ((rects.front.y0 + 1) * 32 + (rects.front.x0 + 1)) * 4;
    expect([result.pixels.data[offset], result.pixels.data[offset + 1], result.pixels.data[offset + 2], result.pixels.data[offset + 3]]).toEqual([0, 0, 255, 255]);
  });

  it('respeta el factor "scale" (resolucion de trabajo mayor a x1)', () => {
    const scale = 2;
    const current = blankPixels(64, 64);
    const result = validateAndApplyColorProposal({ parts: { body: { front: '#ff00ff' } } }, GEOMETRY, current, scale);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const part = GEOMETRY.parts.body!;
    const [w, h, d] = part.size;
    const rects = computeBoxFaceRects(part.uv.x * scale, part.uv.y * scale, w * scale, h * scale, d * scale);
    const offset = ((rects.front.y0 + 1) * 64 + (rects.front.x0 + 1)) * 4;
    expect([result.pixels.data[offset], result.pixels.data[offset + 1], result.pixels.data[offset + 2], result.pixels.data[offset + 3]]).toEqual([255, 0, 255, 255]);
  });

  it('permite omitir caras y partes -- una propuesta parcial es valida', () => {
    const result = validateAndApplyColorProposal({ parts: { body: { front: '#111111', top: '#222222' } } }, GEOMETRY, blankPixels(32, 32));
    expect(result.ok).toBe(true);
  });
});
