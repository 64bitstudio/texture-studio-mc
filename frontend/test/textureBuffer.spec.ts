import { describe, expect, it } from 'vitest';
import { TextureBuffer, bresenhamLine } from '../src/textureBuffer';

const RED = { r: 255, g: 0, b: 0, a: 255 };
const BLUE = { r: 0, g: 0, b: 255, a: 255 };

describe('TextureBuffer', () => {
  it('se inicializa transparente (todo ceros) sin initialData', () => {
    const buffer = new TextureBuffer(4, 2);
    expect(buffer.getPixel(0, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(buffer.getPixel(3, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('rechaza dimensiones invalidas', () => {
    expect(() => new TextureBuffer(0, 2)).toThrow(RangeError);
    expect(() => new TextureBuffer(2, -1)).toThrow(RangeError);
  });

  it('rechaza initialData con longitud incorrecta', () => {
    expect(() => new TextureBuffer(2, 2, new Uint8ClampedArray(3))).toThrow(RangeError);
  });

  it('setPixel pinta y getPixel lee exactamente ese color', () => {
    const buffer = new TextureBuffer(4, 4);
    expect(buffer.setPixel(1, 2, RED)).toBe(true);
    expect(buffer.getPixel(1, 2)).toEqual(RED);
    // Pixeles vecinos no se ven afectados.
    expect(buffer.getPixel(0, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(buffer.getPixel(2, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('setPixel fuera de rango es un no-op seguro (no lanza, devuelve false)', () => {
    const buffer = new TextureBuffer(4, 4);
    expect(buffer.setPixel(-1, 0, RED)).toBe(false);
    expect(buffer.setPixel(4, 0, RED)).toBe(false);
    expect(buffer.setPixel(0, 4, RED)).toBe(false);
    expect(buffer.setPixel(1.5, 0, RED)).toBe(false);
  });

  it('getPixel fuera de rango lanza (a diferencia de setPixel)', () => {
    const buffer = new TextureBuffer(4, 4);
    expect(() => buffer.getPixel(10, 10)).toThrow(RangeError);
  });

  it('getRawData devuelve una copia (mutarla no afecta al buffer)', () => {
    const buffer = new TextureBuffer(2, 2);
    buffer.setPixel(0, 0, RED);
    const raw = buffer.getRawData();
    raw[0] = 0;
    expect(buffer.getPixel(0, 0)).toEqual(RED);
  });

  describe('loadFromImageData', () => {
    it('reemplaza todo el contenido cuando las dimensiones coinciden', () => {
      const buffer = new TextureBuffer(2, 1);
      const data = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]);
      buffer.loadFromImageData({ width: 2, height: 1, data });
      expect(buffer.getPixel(0, 0)).toEqual({ r: 1, g: 2, b: 3, a: 4 });
      expect(buffer.getPixel(1, 0)).toEqual({ r: 5, g: 6, b: 7, a: 8 });
    });

    it('rechaza dimensiones que no coinciden con el buffer', () => {
      const buffer = new TextureBuffer(64, 32);
      const data = new Uint8ClampedArray(4 * 4 * 4);
      expect(() => buffer.loadFromImageData({ width: 4, height: 4, data })).toThrow(RangeError);
    });
  });

  describe('paintLine (modo brocha)', () => {
    it('con un solo punto (from === to) pinta solo esa celda', () => {
      const buffer = new TextureBuffer(4, 4);
      const painted = buffer.paintLine(1, 1, 1, 1, RED);
      expect(painted).toEqual([{ x: 1, y: 1 }]);
      expect(buffer.getPixel(1, 1)).toEqual(RED);
    });

    it('pinta una diagonal sin saltarse celdas intermedias', () => {
      const buffer = new TextureBuffer(5, 5);
      buffer.paintLine(0, 0, 3, 3, RED);
      expect(buffer.getPixel(0, 0)).toEqual(RED);
      expect(buffer.getPixel(1, 1)).toEqual(RED);
      expect(buffer.getPixel(2, 2)).toEqual(RED);
      expect(buffer.getPixel(3, 3)).toEqual(RED);
    });

    it('pinta una linea mas horizontal que vertical sin huecos en x', () => {
      const buffer = new TextureBuffer(10, 10);
      buffer.paintLine(0, 0, 6, 2, BLUE);
      // Cada columna entre 0 y 6 debe tener al menos un pixel pintado
      // (criterio de aceptacion HU-2: sin "saltarse" pixeles).
      for (let x = 0; x <= 6; x += 1) {
        const paintedInColumn = [0, 1, 2].some((y) => {
          const p = buffer.getPixel(x, y);
          return p.r === BLUE.r && p.g === BLUE.g && p.b === BLUE.b && p.a === BLUE.a;
        });
        expect(paintedInColumn).toBe(true);
      }
    });

    it('pinta una linea vertical exacta', () => {
      const buffer = new TextureBuffer(4, 6);
      buffer.paintLine(2, 0, 2, 4, RED);
      for (let y = 0; y <= 4; y += 1) {
        expect(buffer.getPixel(2, y)).toEqual(RED);
      }
    });

    it('recorta las celdas fuera de rango sin lanzar y devuelve solo las pintadas', () => {
      const buffer = new TextureBuffer(3, 3);
      const painted = buffer.paintLine(-2, 0, 2, 0, RED);
      // Solo (0,0),(1,0),(2,0) caen dentro del buffer de 3x3.
      expect(painted).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]);
    });
  });
});

describe('bresenhamLine', () => {
  it('incluye ambos extremos', () => {
    const points = bresenhamLine(0, 0, 3, 0);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points.at(-1)).toEqual({ x: 3, y: 0 });
  });

  it('con el mismo punto de inicio y fin devuelve un solo punto', () => {
    expect(bresenhamLine(5, 5, 5, 5)).toEqual([{ x: 5, y: 5 }]);
  });

  it('funciona en las 4 direcciones diagonales', () => {
    expect(bresenhamLine(0, 0, 2, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
    expect(bresenhamLine(0, 0, -2, -2)).toEqual([
      { x: 0, y: 0 },
      { x: -1, y: -1 },
      { x: -2, y: -2 },
    ]);
    expect(bresenhamLine(0, 0, 2, -2)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: -1 },
      { x: 2, y: -2 },
    ]);
    expect(bresenhamLine(0, 0, -2, 2)).toEqual([
      { x: 0, y: 0 },
      { x: -1, y: 1 },
      { x: -2, y: 2 },
    ]);
  });
});
