import { describe, expect, it } from 'vitest';
import {
  clampRectToBox,
  computeBurnPixels,
  computeFullReplaceDiff,
  computeInitialPasteRect,
  findTargetUVBox,
  fitRectToBox,
  fitRectToRegionExact,
  nearestSourceIndex,
  sampleSourceForDestPixel,
  validateImportDimensions,
  type OverlayRect,
} from '../src/importImage';
import type { PixelSource, RGBA } from '../src/textureBuffer';
import type { UVBoxRect } from '../src/symmetry';

const RED: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const BLUE: RGBA = { r: 0, g: 0, b: 255, a: 255 };
const GREEN: RGBA = { r: 0, g: 255, b: 0, a: 255 };
const YELLOW: RGBA = { r: 255, g: 255, b: 0, a: 255 };

function solidSource(width: number, height: number, color: RGBA): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    data[o] = color.r;
    data[o + 1] = color.g;
    data[o + 2] = color.b;
    data[o + 3] = color.a;
  }
  return { width, height, data };
}

describe('validateImportDimensions', () => {
  it('devuelve null cuando las dimensiones coinciden exactamente', () => {
    expect(validateImportDimensions({ width: 64, height: 32 }, { width: 64, height: 32 })).toBeNull();
  });

  it('devuelve un mensaje de error claro cuando el ancho no coincide', () => {
    const message = validateImportDimensions({ width: 32, height: 32 }, { width: 64, height: 32 });
    expect(message).toContain('64');
    expect(message).toContain('32');
  });

  it('devuelve un mensaje de error claro cuando el alto no coincide', () => {
    const message = validateImportDimensions({ width: 64, height: 64 }, { width: 64, height: 32 });
    expect(message).not.toBeNull();
  });
});

describe('computeFullReplaceDiff', () => {
  it('no devuelve cambios cuando ambas fuentes son identicas', () => {
    const a = solidSource(2, 2, RED);
    const b = solidSource(2, 2, RED);
    expect(computeFullReplaceDiff(a, b)).toEqual([]);
  });

  it('detecta solo los pixeles que efectivamente cambian, con before/after correctos', () => {
    const current = solidSource(2, 1, RED);
    const next: PixelSource = { width: 2, height: 1, data: new Uint8ClampedArray(current.data) };
    // Cambia solo el segundo pixel (x=1,y=0).
    next.data.set([BLUE.r, BLUE.g, BLUE.b, BLUE.a], 4);

    const changes = computeFullReplaceDiff(current, next);
    expect(changes).toEqual([{ x: 1, y: 0, before: RED, after: BLUE }]);
  });

  it('reporta coordenadas x,y correctas para una fuente multi-fila', () => {
    const current = solidSource(3, 2, RED);
    const next: PixelSource = { width: 3, height: 2, data: new Uint8ClampedArray(current.data) };
    // Cambia (x=2, y=1) -- indice de pixel 5 (fila 1, columna 2).
    const idx = (1 * 3 + 2) * 4;
    next.data.set([GREEN.r, GREEN.g, GREEN.b, GREEN.a], idx);

    const changes = computeFullReplaceDiff(current, next);
    expect(changes).toEqual([{ x: 2, y: 1, before: RED, after: GREEN }]);
  });
});

describe('fitRectToBox', () => {
  const box: UVBoxRect = { x0: 0, y0: 0, x1: 32, y1: 16 }; // caja cabeza, 32x16

  it('centra y ajusta por contencion una imagen mas ancha que alta dentro de una caja mas ancha que alta', () => {
    const rect = fitRectToBox({ width: 64, height: 16 }, box); // proporcion 4:1, caja es 2:1
    // Limitado por el ancho: scale = 32/64 = 0.5 -> height = 16*0.5 = 8.
    expect(rect.width).toBe(32);
    expect(rect.height).toBe(8);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(4); // (16-8)/2
  });

  it('centra y ajusta por contencion una imagen cuadrada dentro de una caja mas ancha que alta', () => {
    const rect = fitRectToBox({ width: 10, height: 10 }, box);
    // Limitado por el alto: scale = 16/10 = 1.6 -> width = 16.
    expect(rect.width).toBe(16);
    expect(rect.height).toBe(16);
    expect(rect.x).toBe(8); // (32-16)/2
    expect(rect.y).toBe(0);
  });

  it('nunca produce un rectangulo de ancho o alto menor a 1', () => {
    const tinyBox: UVBoxRect = { x0: 0, y0: 0, x1: 1, y1: 1 };
    const rect = fitRectToBox({ width: 100, height: 1 }, tinyBox);
    expect(rect.width).toBeGreaterThanOrEqual(1);
    expect(rect.height).toBeGreaterThanOrEqual(1);
  });
});

describe('fitRectToRegionExact (ticket 013)', () => {
  it('devuelve exactamente la posicion y dimensiones de la region, sin preservar proporcion', () => {
    const region: UVBoxRect = { x0: 8, y0: 8, x1: 16, y1: 16 }; // region "Cara", 8x8
    expect(fitRectToRegionExact(region)).toEqual({ x: 8, y: 8, width: 8, height: 8 });
  });

  it('estira (escala no uniforme) para una region rectangular no cuadrada', () => {
    const region: UVBoxRect = { x0: 0, y0: 16, x1: 24, y1: 32 }; // 24x16
    expect(fitRectToRegionExact(region)).toEqual({ x: 0, y: 16, width: 24, height: 16 });
  });

  it('nunca produce un rectangulo de ancho o alto menor a 1', () => {
    const degenerate: UVBoxRect = { x0: 5, y0: 5, x1: 5, y1: 5 };
    const rect = fitRectToRegionExact(degenerate);
    expect(rect.width).toBeGreaterThanOrEqual(1);
    expect(rect.height).toBeGreaterThanOrEqual(1);
  });
});

describe('computeInitialPasteRect (ticket 013)', () => {
  const firstBox: UVBoxRect = { x0: 0, y0: 0, x1: 32, y1: 16 }; // caja cabeza, 32x16
  const isolatedRegion: UVBoxRect = { x0: 8, y0: 8, x1: 16, y1: 16 }; // region "Cara", 8x8

  it('con una parte aislada activa, ajusta EXACTO a sus dimensiones sin importar el tamaño/proporcion de la imagen fuente', () => {
    const rect = computeInitialPasteRect({ width: 200, height: 10 }, isolatedRegion, firstBox);
    expect(rect).toEqual({ x: 8, y: 8, width: 8, height: 8 });
  });

  it('con una parte aislada activa, el resultado es identico independientemente de la imagen (misma region, imagenes distintas)', () => {
    const rectA = computeInitialPasteRect({ width: 1, height: 1 }, isolatedRegion, firstBox);
    const rectB = computeInitialPasteRect({ width: 512, height: 512 }, isolatedRegion, firstBox);
    expect(rectA).toEqual(rectB);
  });

  it('sin parte aislada, delega en fitRectToBox contra la caja de respaldo -- comportamiento identico al ticket 005', () => {
    const rect = computeInitialPasteRect({ width: 64, height: 16 }, null, firstBox);
    expect(rect).toEqual(fitRectToBox({ width: 64, height: 16 }, firstBox));
  });

  it('sin parte aislada y sin caja de respaldo, usa el tamaño original de la imagen en el origen', () => {
    const rect = computeInitialPasteRect({ width: 12, height: 7 }, null, null);
    expect(rect).toEqual({ x: 0, y: 0, width: 12, height: 7 });
  });
});

describe('clampRectToBox', () => {
  const box: UVBoxRect = { x0: 10, y0: 10, x1: 20, y1: 20 };

  it('devuelve la interseccion cuando el rect se superpone parcialmente con la caja', () => {
    const rect: OverlayRect = { x: 5, y: 5, width: 10, height: 10 }; // cubre (5,5)-(15,15)
    expect(clampRectToBox(rect, box)).toEqual({ x0: 10, y0: 10, x1: 15, y1: 15 });
  });

  it('devuelve la caja completa cuando el rect la contiene por completo', () => {
    const rect: OverlayRect = { x: 0, y: 0, width: 100, height: 100 };
    expect(clampRectToBox(rect, box)).toEqual({ x0: 10, y0: 10, x1: 20, y1: 20 });
  });

  it('devuelve null cuando no hay superposicion', () => {
    const rect: OverlayRect = { x: 100, y: 100, width: 5, height: 5 };
    expect(clampRectToBox(rect, box)).toBeNull();
  });

  it('devuelve null cuando el rect solo toca el borde sin area real de superposicion', () => {
    const rect: OverlayRect = { x: 20, y: 10, width: 5, height: 5 }; // arranca exactamente en box.x1
    expect(clampRectToBox(rect, box)).toBeNull();
  });
});

describe('findTargetUVBox', () => {
  // Mismas 4 cajas UV del Esqueleto (64x32) que en symmetry.spec.ts.
  const boxes: UVBoxRect[] = [
    { x0: 0, y0: 0, x1: 32, y1: 16 }, // cabeza
    { x0: 16, y0: 16, x1: 40, y1: 32 }, // torso
    { x0: 40, y0: 16, x1: 56, y1: 32 }, // brazo
    { x0: 0, y0: 16, x1: 16, y1: 32 }, // pierna
  ];

  it('elige la caja con mayor area de superposicion', () => {
    // Mayormente dentro de la cabeza, apenas roza el torso -- no deberia pasar.
    const rect: OverlayRect = { x: 5, y: 5, width: 10, height: 10 };
    expect(findTargetUVBox(rect, boxes)).toEqual(boxes[0]);
  });

  it('elige la caja del torso cuando el overlay se superpone mas con el torso que con la cabeza', () => {
    // Overlay que cruza cabeza (0-16) y torso (16-32) en y, pero centrado en el torso.
    const rect: OverlayRect = { x: 20, y: 10, width: 8, height: 20 };
    expect(findTargetUVBox(rect, boxes)).toEqual(boxes[1]);
  });

  it('devuelve null cuando el overlay cae enteramente en una zona de relleno sin caja UV', () => {
    // x:56-64, y:16-32 -- relleno a la derecha del brazo, sin caja conocida.
    const rect: OverlayRect = { x: 58, y: 20, width: 4, height: 4 };
    expect(findTargetUVBox(rect, boxes)).toBeNull();
  });
});

describe('nearestSourceIndex', () => {
  it('mapea el primer texel destino al primer texel fuente', () => {
    expect(nearestSourceIndex(0, 0, 4, 4)).toBe(0);
  });

  it('mapea el ultimo texel destino al ultimo texel fuente (sin desbordar)', () => {
    expect(nearestSourceIndex(3, 0, 4, 4)).toBe(3);
  });

  it('reduce (downscale): varios texeles destino pueden mapear al mismo texel fuente', () => {
    // Destino de 4 texeles, fuente de 2 -- los primeros dos destino deberian mapear al texel fuente 0.
    expect(nearestSourceIndex(0, 0, 4, 2)).toBe(0);
    expect(nearestSourceIndex(1, 0, 4, 2)).toBe(0);
    expect(nearestSourceIndex(2, 0, 4, 2)).toBe(1);
    expect(nearestSourceIndex(3, 0, 4, 2)).toBe(1);
  });

  it('agranda (upscale): el mismo texel fuente se repite en varios texeles destino', () => {
    // Destino de 4 texeles, fuente de 2 (invertido respecto al caso anterior) -- ya cubierto arriba
    // simetricamente; aca se verifica el caso fuente > destino (agranda la imagen pequeña).
    expect(nearestSourceIndex(0, 0, 2, 4)).toBe(1);
    expect(nearestSourceIndex(1, 0, 2, 4)).toBe(3);
  });

  it('respeta un origen de rectangulo distinto de cero', () => {
    expect(nearestSourceIndex(10, 10, 4, 4)).toBe(0);
    expect(nearestSourceIndex(13, 10, 4, 4)).toBe(3);
  });
});

describe('sampleSourceForDestPixel', () => {
  it('muestrea nearest-neighbor sin interpolar colores intermedios', () => {
    // Fuente 2x1: pixel izquierdo rojo, pixel derecho azul.
    const source: PixelSource = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([RED.r, RED.g, RED.b, RED.a, BLUE.r, BLUE.g, BLUE.b, BLUE.a]),
    };
    const rect: OverlayRect = { x: 0, y: 0, width: 4, height: 1 }; // estirado a 4 texeles destino

    // Los primeros dos texeles destino deben ser exactamente rojo, los ultimos dos exactamente azul --
    // nunca un color mezclado (nearest-neighbor, no bilinear).
    expect(sampleSourceForDestPixel(source, { x: 0, y: 0 }, rect)).toEqual(RED);
    expect(sampleSourceForDestPixel(source, { x: 1, y: 0 }, rect)).toEqual(RED);
    expect(sampleSourceForDestPixel(source, { x: 2, y: 0 }, rect)).toEqual(BLUE);
    expect(sampleSourceForDestPixel(source, { x: 3, y: 0 }, rect)).toEqual(BLUE);
  });
});

describe('computeBurnPixels', () => {
  const boxes: UVBoxRect[] = [
    { x0: 0, y0: 0, x1: 32, y1: 16 }, // cabeza
    { x0: 16, y0: 16, x1: 40, y1: 32 }, // torso
  ];

  it('devuelve null cuando el overlay no se superpone con ninguna caja UV', () => {
    const source = solidSource(4, 4, RED);
    const rect: OverlayRect = { x: 40, y: 0, width: 4, height: 4 }; // fuera de cualquier caja conocida
    expect(computeBurnPixels(source, rect, boxes)).toBeNull();
  });

  it('quema exactamente los pixeles del overlay cuando cae completamente dentro de una caja', () => {
    const source = solidSource(2, 2, GREEN);
    const rect: OverlayRect = { x: 2, y: 2, width: 2, height: 2 };
    const writes = computeBurnPixels(source, rect, boxes);
    expect(writes).not.toBeNull();
    expect(writes).toHaveLength(4);
    for (const w of writes!) {
      expect(w.color).toEqual(GREEN);
    }
    const coords = writes!.map((w) => `${w.x},${w.y}`).sort();
    expect(coords).toEqual(['2,2', '2,3', '3,2', '3,3']);
  });

  it('NUNCA desborda fuera de la caja UV afectada, aunque el overlay se posicione mas alla de su borde', () => {
    // Overlay de 10x10 posicionado a caballo entre la caja de la cabeza
    // (0,0)-(32,16) y el area fuera de ella (y>=16) -- centro del
    // overlay cae dentro de la cabeza, asi que esa es la caja objetivo.
    const source = solidSource(10, 10, YELLOW);
    const rect: OverlayRect = { x: 10, y: 10, width: 10, height: 10 }; // cubre y: 10-20, la caja cabeza termina en y=16
    const writes = computeBurnPixels(source, rect, boxes);
    expect(writes).not.toBeNull();
    // Ninguna escritura debe caer fuera de [0,32)x[0,16) (la caja cabeza).
    for (const w of writes!) {
      expect(w.y).toBeLessThan(16);
      expect(w.x).toBeLessThan(32);
    }
    // Y efectivamente se recorto -- no las 100 celdas del overlay completo, solo las que caen en la caja.
    expect(writes!.length).toBeLessThan(100);
  });

  it('el recorte a una caja UV nunca "sangra" pixeles quemados hacia una caja UV vecina distinta', () => {
    // Overlay que cruza la frontera cabeza/torso en y=16, con mas area en el torso.
    const source = solidSource(4, 4, BLUE);
    const rect: OverlayRect = { x: 20, y: 12, width: 4, height: 8 }; // y: 12-20, cruza y=16
    const writes = computeBurnPixels(source, rect, boxes);
    expect(writes).not.toBeNull();
    // La caja objetivo es el torso (mayor area de superposicion: 4x4=16 vs cabeza 4x4=16 -- empatan en area,
    // pero solo debe elegirse UNA caja, nunca repartir escrituras entre ambas).
    const inHead = writes!.some((w) => w.y < 16);
    const inBody = writes!.some((w) => w.y >= 16);
    expect(inHead && inBody).toBe(false);
  });
});
