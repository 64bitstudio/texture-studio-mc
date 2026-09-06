import { PNG } from 'pngjs';

// Placeholder 100% procedural (ver docs/ARQUITECTURA.md, "Textura base
// del Esqueleto: placeholder vs. asset real"). NUNCA deriva de ningun
// pixel de un asset de Mojang -- es una cuadricula tenue sobre un color
// solido tipo hueso/gris claro, generada por codigo, deliberadamente
// distinguible a simple vista de la textura vanilla real.
//
// TICKET 016: `width`/`height` se parametrizan (antes fijos a 64x32)
// para que cualquier mob futuro con otro tamaño de textura (ej. el
// Zombie es 64x64, ver el documento de definicion) reciba un placeholder
// de las dimensiones correctas sin tener que volver a tocar este
// archivo -- `loadMobTexture` pasa `geometry.textureWidth/Height` del
// mob solicitado.
const BASE_COLOR: [number, number, number, number] = [214, 209, 197, 255];
const GRID_COLOR: [number, number, number, number] = [176, 170, 156, 255];
const GRID_STEP_PX = 4;

/** Genera el PNG placeholder (`width`x`height`) en memoria -- nunca falla, no depende de I/O. */
export function generatePlaceholderMobTexturePng(width: number, height: number): Buffer {
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
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
