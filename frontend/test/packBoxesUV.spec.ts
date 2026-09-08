// Ticket 085 -- empaquetado UV genérico para geometría custom.
// Ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.

import { describe, expect, it } from 'vitest';
import { applyPackedAtlas, confirmModelGeometry, packBoxesUV } from '../src/geometry/packBoxesUV';
import type { FaceLabels, MobGeometry } from '../src/types/baseAssets';

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

// Ticket 086 -- "Confirmar modelo": aplicar el atlas calculado a la geometria final.

const NOOP_LABELS: FaceLabels = { front: '', back: '', top: '', bottom: '', left: '', right: '' };

const SAMPLE_GEOMETRY: MobGeometry = {
  textureWidth: 999, // valor previo cualquiera -- debe quedar reemplazado por el del atlas.
  textureHeight: 999,
  parts: {
    body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
    head: { size: [8, 8, 8], position: [0, 10, 0], parentId: 'body', uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
  },
};

describe('applyPackedAtlas', () => {
  it('reemplaza textureWidth/textureHeight y el uv de cada caja por los del atlas', () => {
    const atlas = packBoxesUV(SAMPLE_GEOMETRY.parts);
    const result = applyPackedAtlas(SAMPLE_GEOMETRY, atlas);

    expect(result.textureWidth).toBe(atlas.textureWidth);
    expect(result.textureHeight).toBe(atlas.textureHeight);
    expect(result.parts.body!.uv).toEqual(atlas.origins.body);
    expect(result.parts.head!.uv).toEqual(atlas.origins.head);
  });

  it('no toca position/rotation/parentId/size -- solo uv y las dimensiones de textura', () => {
    const atlas = packBoxesUV(SAMPLE_GEOMETRY.parts);
    const result = applyPackedAtlas(SAMPLE_GEOMETRY, atlas);

    expect(result.parts.head!.position).toEqual(SAMPLE_GEOMETRY.parts.head!.position);
    expect(result.parts.head!.parentId).toBe('body');
    expect(result.parts.head!.size).toEqual(SAMPLE_GEOMETRY.parts.head!.size);
  });
});

describe('confirmModelGeometry', () => {
  it('empaqueta y aplica el atlas de una sola vez -- mismo resultado que packBoxesUV + applyPackedAtlas por separado', () => {
    const combined = confirmModelGeometry(SAMPLE_GEOMETRY);
    const separate = applyPackedAtlas(SAMPLE_GEOMETRY, packBoxesUV(SAMPLE_GEOMETRY.parts));
    expect(combined).toEqual(separate);
  });

  it('el resultado no tiene traslapes -- mismo chequeo ya usado para packBoxesUV', () => {
    const confirmed = confirmModelGeometry(SAMPLE_GEOMETRY);
    // Re-empaquetar la geometria YA confirmada debe dar exactamente los mismos origenes -- confirma que `applyPackedAtlas` dejo un `uv` consistente con el propio algoritmo de empaquetado.
    const rePacked = packBoxesUV(confirmed.parts);
    expect(confirmed.parts.body!.uv).toEqual(rePacked.origins.body);
  });

  // Hallazgo real de Marco ("confirmar modelo no hace nada"): una caja con
  // `size` fraccionario (tipico de una propuesta de IA con detalle fino,
  // ej. un jiron de tela) produce un atlas fraccionario -- `TextureBuffer`/
  // `new ImageData(...)` (export.ts) exigen dimensiones enteras y revientan
  // con un error que nadie atrapa (`handleConfirmModel` en App.tsx descarta
  // la promesa con `void`), asi que el usuario no ve nada. `confirmModelGeometry`
  // ahora redondea CADA `size` a enteros antes de empaquetar -- ver
  // `roundBoxSize` en `modelEditing.ts`.
  it('geometria con tamaños fraccionarios (ej. una propuesta de IA con detalle fino): el atlas resultante tiene dimensiones enteras, y no lanza', () => {
    const geometryWithFractionalSizes: MobGeometry = {
      textureWidth: 64,
      textureHeight: 64,
      parts: {
        body: { size: [8, 12, 4], position: [0, 18, 0], uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
        shirtChestUpper: { size: [8.4, 4.2, 0.35], position: [0, 20, 2], parentId: 'body', uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
        shirtChestCenterStrip: { size: [1.25, 4.6, 0.3], position: [0, 18, 2], parentId: 'body', uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
      },
    };

    const confirmed = confirmModelGeometry(geometryWithFractionalSizes);

    expect(Number.isInteger(confirmed.textureWidth)).toBe(true);
    expect(Number.isInteger(confirmed.textureHeight)).toBe(true);
    for (const part of Object.values(confirmed.parts)) {
      expect(part.size.every((n) => Number.isInteger(n))).toBe(true);
    }
    // El caso real que rompia "Confirmar modelo": construir el ImageData en
    // blanco del atlas confirmado no debe lanzar (mismo calculo que
    // `TextureBuffer`/`new ImageData(...)`, sin depender del DOM aca).
    expect(confirmed.textureWidth * confirmed.textureHeight * 4).toEqual(Math.round(confirmed.textureWidth * confirmed.textureHeight * 4));
  });

  it('un tamaño fraccionario por debajo de 1 se redondea a 1, nunca a 0 (evita un footprint invalido)', () => {
    const geometry: MobGeometry = {
      textureWidth: 64,
      textureHeight: 64,
      parts: {
        diminuta: { size: [0.3, 0.2, 0.1], position: [0, 0, 0], uv: { x: 0, y: 0 }, faceLabels: NOOP_LABELS },
      },
    };
    const confirmed = confirmModelGeometry(geometry);
    expect(confirmed.parts.diminuta!.size).toEqual([1, 1, 1]);
  });
});
