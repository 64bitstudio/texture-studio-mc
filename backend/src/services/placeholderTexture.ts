import { PNG } from 'pngjs';

// Placeholder 100% procedural (ver docs/ARQUITECTURA.md, "Textura base
// del Esqueleto: placeholder vs. asset real"). NUNCA deriva de ningun
// pixel de un asset de Mojang -- es una cuadricula tenue sobre un color
// solido tipo hueso/gris claro, generada por codigo, deliberadamente
// distinguible a simple vista de la textura vanilla real.
const TEXTURE_WIDTH = 64;
const TEXTURE_HEIGHT = 32;
const BASE_COLOR: [number, number, number, number] = [214, 209, 197, 255];
const GRID_COLOR: [number, number, number, number] = [176, 170, 156, 255];
const GRID_STEP_PX = 4;

/** Genera el PNG placeholder (64x32) en memoria -- nunca falla, no depende de I/O. */
export function generatePlaceholderSkeletonTexturePng(): Buffer {
  const png = new PNG({ width: TEXTURE_WIDTH, height: TEXTURE_HEIGHT });

  for (let y = 0; y < TEXTURE_HEIGHT; y++) {
    for (let x = 0; x < TEXTURE_WIDTH; x++) {
      const idx = (TEXTURE_WIDTH * y + x) << 2;
      const onGridLine = x % GRID_STEP_PX === 0 || y % GRID_STEP_PX === 0;
      const [r, g, b, a] = onGridLine ? GRID_COLOR : BASE_COLOR;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  return PNG.sync.write(png);
}
