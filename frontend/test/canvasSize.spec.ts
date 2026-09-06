import { describe, expect, it } from 'vitest';
import { canvasOverflowsAvailableWidth, computeCanvasDisplaySize } from '../src/canvasSize';

describe('computeCanvasDisplaySize', () => {
  it('escala ambas dimensiones por el MISMO factor (zoom) -- garantiza texeles cuadrados', () => {
    const size = computeCanvasDisplaySize(64, 32, 10);
    expect(size).toEqual({ width: 640, height: 320 });
    expect(size.width / 64).toBe(size.height / 32);
  });

  it('funciona igual para dimensiones de textura escaladas por resolucion (ticket 009, ej. x4 -> 256x128)', () => {
    const size = computeCanvasDisplaySize(256, 128, 4);
    expect(size).toEqual({ width: 1024, height: 512 });
    expect(size.width / 256).toBe(size.height / 128);
  });

  it('es independiente de cualquier ancho de contenedor -- nunca reescala para "caber"', () => {
    // Un ancho de panel muy angosto no debe cambiar el resultado: el
    // ancho disponible del contenedor decide si hay scroll, nunca si el
    // canvas se encoge (ver canvasOverflowsAvailableWidth mas abajo).
    const wide = computeCanvasDisplaySize(64, 32, 40);
    expect(wide).toEqual({ width: 2560, height: 1280 });
  });
});

describe('canvasOverflowsAvailableWidth', () => {
  it('false cuando el canvas cabe en el ancho disponible', () => {
    expect(canvasOverflowsAvailableWidth(300, 400)).toBe(false);
    expect(canvasOverflowsAvailableWidth(300, 300)).toBe(false);
  });

  it('true cuando el canvas excede el ancho disponible', () => {
    expect(canvasOverflowsAvailableWidth(640, 220)).toBe(true);
  });

  it('false (todavia no se midio) cuando availableWidth es null -- evita un scroll fantasma antes del primer ResizeObserver', () => {
    expect(canvasOverflowsAvailableWidth(640, null)).toBe(false);
  });
});
