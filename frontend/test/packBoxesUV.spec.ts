// Ticket 085 -- empaquetado UV genérico para geometría custom.
// Ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.

import { describe, expect, it } from 'vitest';
import { packBoxesUV } from '../src/geometry/packBoxesUV';

/** Rectangulo de footprint (mismo calculo que `packBoxesUV`: ancho 2d+2w, alto d+h) -- reimplementado aca a proposito para verificar la propiedad "sin traslapes" de forma independiente, no confiando ciegamente en el mismo codigo que se prueba. */
function footprintRect(origin: { x: number; y: number }, size: [number, number, number]) {
  const [w, h, d] = size;
  return { x: origin.x, y: origin.y, w: 2 * d + 2 * w, h: d + h };
}

function rectsOverlap(a: ReturnType<typeof footprintRect>, b: ReturnType<typeof footprintRect>): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

/** Verifica que ningun par de cajas de `parts` quede traslapado en el atlas empaquetado. */
function assertNoOverlaps(parts: Record<string, { size: [number, number, number]; group?: string }>, atlas: ReturnType<typeof packBoxesUV>) {
  const names = Object.keys(parts);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const nameA = names[i]!;
      const nameB = names[j]!;
      // Cajas del mismo grupo COMPARTEN region a proposito -- no es un traslape real.
      if (parts[nameA]!.group && parts[nameA]!.group === parts[nameB]!.group) continue;

      const rectA = footprintRect(atlas.origins[nameA]!, parts[nameA]!.size);
      const rectB = footprintRect(atlas.origins[nameB]!, parts[nameB]!.size);
      expect(rectsOverlap(rectA, rectB), `'${nameA}' y '${nameB}' se traslapan`).toBe(false);
    }
  }
}

describe('packBoxesUV -- casos basicos', () => {
  it('sin cajas: devuelve un atlas vacio sin lanzar', () => {
    expect(packBoxesUV({})).toEqual({ textureWidth: 0, textureHeight: 0, origins: {} });
  });

  it('una sola caja: el atlas mide exactamente su footprint, origen en (0,0)', () => {
    const atlas = packBoxesUV({ body: { size: [8, 12, 4] } });
    expect(atlas.origins.body).toEqual({ x: 0, y: 0 });
    expect(atlas.textureWidth).toBe(2 * 4 + 2 * 8); // 24
    expect(atlas.textureHeight).toBe(4 + 12); // 16
  });

  it('muchas cajas (8): ninguna se traslapa, todas reciben un origen', () => {
    const parts: Record<string, { size: [number, number, number] }> = {};
    for (let i = 0; i < 8; i++) {
      parts[`box${i}`] = { size: [4 + i, 6 + i, 2 + (i % 3)] };
    }
    const atlas = packBoxesUV(parts);
    expect(Object.keys(atlas.origins)).toHaveLength(8);
    assertNoOverlaps(parts, atlas);
  });

  it('tamaños muy dispares (una caja enorme + una diminuta): no se traslapan, y la enorme no rompe el ancho del atlas', () => {
    const parts = {
      enorme: { size: [40, 50, 30] as [number, number, number] },
      diminuta: { size: [1, 1, 1] as [number, number, number] },
    };
    const atlas = packBoxesUV(parts);
    assertNoOverlaps(parts, atlas);
    // El atlas debe crecer para acomodar el footprint de la caja enorme (2*30+2*40 = 140), no truncarlo al maxWidth por defecto (64).
    expect(atlas.textureWidth).toBeGreaterThanOrEqual(2 * 30 + 2 * 40);
  });

  it('cajas del mismo grupo comparten el mismo origen UV (ej. brazo derecho/izquierdo)', () => {
    const parts = {
      armRight: { size: [2, 12, 2] as [number, number, number], group: 'arm' },
      armLeft: { size: [2, 12, 2] as [number, number, number], group: 'arm' },
      body: { size: [8, 12, 4] as [number, number, number] },
    };
    const atlas = packBoxesUV(parts);
    expect(atlas.origins.armRight).toEqual(atlas.origins.armLeft);
    expect(atlas.origins.armRight).not.toEqual(atlas.origins.body);
    assertNoOverlaps(parts, atlas);
  });

  it('un maxWidth mas angosto produce mas filas (atlas mas alto) sin traslapes', () => {
    const parts = {
      a: { size: [8, 8, 8] as [number, number, number] }, // footprint 32x16
      b: { size: [8, 8, 8] as [number, number, number] },
    };
    const wide = packBoxesUV(parts, 64);
    const narrow = packBoxesUV(parts, 32);

    expect(wide.textureHeight).toBe(16); // ambas caben en una sola fila de 64
    expect(narrow.textureHeight).toBe(32); // cada una en su propia fila de 32
    assertNoOverlaps(parts, wide);
    assertNoOverlaps(parts, narrow);
  });
});

// --- Verificacion contra los 4 mobs vainilla reales (criterio de aceptacion
// explicito del ticket: "no produce regresion visible"). Los tamaños de caja
// son un espejo manual de `backend/src/geometry/*.ts` (mismo criterio de
// sincronizacion ya usado en `frontend/src/types/baseAssets.ts`) -- estos
// mobs NUNCA pasan por `packBoxesUV` en la app real (siguen usando su `uv`
// fijo de siempre); esto solo prueba que el algoritmo generaliza
// correctamente a geometria real, no solo a casos sinteticos.

describe('packBoxesUV -- contra las 4 geometrias vainilla reales (sin regresion)', () => {
  const VANILLA_PART_SETS: Record<string, Record<string, { size: [number, number, number]; group?: string }>> = {
    skeleton: {
      head: { size: [8, 8, 8] },
      body: { size: [8, 12, 4] },
      armRight: { size: [2, 12, 2], group: 'arm' },
      armLeft: { size: [2, 12, 2], group: 'arm' },
      legRight: { size: [2, 12, 2], group: 'leg' },
      legLeft: { size: [2, 12, 2], group: 'leg' },
    },
    zombie: {
      head: { size: [8, 8, 8] },
      body: { size: [8, 12, 4] },
      armRight: { size: [4, 12, 4], group: 'arm' },
      armLeft: { size: [4, 12, 4], group: 'arm' },
      legRight: { size: [4, 12, 4], group: 'leg' },
      legLeft: { size: [4, 12, 4], group: 'leg' },
    },
    spider: {
      head: { size: [8, 8, 8] },
      thorax: { size: [6, 6, 6] },
      abdomen: { size: [10, 8, 12] },
      leg1Right: { size: [16, 2, 2], group: 'spiderLeg' },
      leg1Left: { size: [16, 2, 2], group: 'spiderLeg' },
      leg2Right: { size: [16, 2, 2], group: 'spiderLeg' },
      leg2Left: { size: [16, 2, 2], group: 'spiderLeg' },
      leg3Right: { size: [16, 2, 2], group: 'spiderLeg' },
      leg3Left: { size: [16, 2, 2], group: 'spiderLeg' },
      leg4Right: { size: [16, 2, 2], group: 'spiderLeg' },
      leg4Left: { size: [16, 2, 2], group: 'spiderLeg' },
    },
    creeper: {
      head: { size: [8, 8, 8] },
      body: { size: [8, 12, 4] },
      legFrontRight: { size: [4, 6, 4], group: 'creeperLeg' },
      legFrontLeft: { size: [4, 6, 4], group: 'creeperLeg' },
      legBackRight: { size: [4, 6, 4], group: 'creeperLeg' },
      legBackLeft: { size: [4, 6, 4], group: 'creeperLeg' },
    },
  };

  it.each(Object.entries(VANILLA_PART_SETS))('%s: produce un atlas valido (sin traslapes, cada caja con origen) a partir de su geometria real', (_mobId, parts) => {
    const atlas = packBoxesUV(parts);
    expect(Object.keys(atlas.origins)).toHaveLength(Object.keys(parts).length);
    assertNoOverlaps(parts, atlas);
    expect(atlas.textureWidth).toBeGreaterThan(0);
    expect(atlas.textureHeight).toBeGreaterThan(0);
  });
});
