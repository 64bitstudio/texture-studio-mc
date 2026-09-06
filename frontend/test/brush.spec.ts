import { describe, expect, it } from 'vitest';
import { computeBrushFootprint, computeBrushFootprintForLine } from '../src/brush';

describe('computeBrushFootprint', () => {
  it('size=1 devuelve solo el punto central', () => {
    expect(computeBrushFootprint({ x: 5, y: 5 }, 1)).toEqual([{ x: 5, y: 5 }]);
  });

  it('size=1 es el default seguro para cualquier valor <= 1 (0, negativo)', () => {
    expect(computeBrushFootprint({ x: 5, y: 5 }, 0)).toEqual([{ x: 5, y: 5 }]);
    expect(computeBrushFootprint({ x: 5, y: 5 }, -3)).toEqual([{ x: 5, y: 5 }]);
  });

  it('size=3 devuelve un bloque de 3x3 (9 puntos) centrado en el punto', () => {
    const result = computeBrushFootprint({ x: 5, y: 5 }, 3);
    expect(result).toHaveLength(9);
    expect(result).toContainEqual({ x: 5, y: 5 }); // centro
    expect(result).toContainEqual({ x: 4, y: 4 }); // esquina superior-izquierda
    expect(result).toContainEqual({ x: 6, y: 6 }); // esquina inferior-derecha
  });

  it('size=2 (par) devuelve un bloque de 2x2 (4 puntos), redondeado hacia -x/-y', () => {
    const result = computeBrushFootprint({ x: 10, y: 10 }, 2);
    expect(result.sort((a, b) => a.x - b.x || a.y - b.y)).toEqual([
      { x: 9, y: 9 },
      { x: 9, y: 10 },
      { x: 10, y: 9 },
      { x: 10, y: 10 },
    ]);
  });

  it('size=5 devuelve un bloque de 5x5 (25 puntos)', () => {
    expect(computeBrushFootprint({ x: 0, y: 0 }, 5)).toHaveLength(25);
  });
});

describe('computeBrushFootprintForLine', () => {
  it('size=1 devuelve la linea tal cual, sin expandir', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    expect(computeBrushFootprintForLine(line, 1)).toEqual(line);
  });

  it('size>1 expande CADA punto de la linea a su propio bloque', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const result = computeBrushFootprintForLine(line, 3);
    expect(result).toHaveLength(2 * 9); // 2 puntos * 9 celdas cada uno (sin deduplicar aca)
  });

  it('linea vacia devuelve vacio', () => {
    expect(computeBrushFootprintForLine([], 3)).toEqual([]);
  });
});
