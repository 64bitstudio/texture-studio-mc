// TextureBuffer -- unica fuente de verdad de los pixeles editables
// (ticket 002, HU-2/HU-3/HU-5, y arquitectura extensible de HU-12: ver
// docs/definiciones/editor-3d-texturas-esqueleto.md).
//
// Deliberadamente independiente de React/DOM/three.js en su nucleo: el
// unico metodo que toca una API exclusiva del navegador es
// `toImageData()` (construye un `ImageData` real para pintarlo en un
// `<canvas>`). Todo lo demas opera sobre un `Uint8ClampedArray` plano,
// para que:
//   - sea testeable con Vitest sin jsdom (ver `frontend/test/textureBuffer.spec.ts`).
//   - cualquier fuente futura de escritura (pincel de hoy, importar/
//     pegar imagen del ticket 005, generacion por IA de HU-12) escriba
//     a traves de la MISMA interfaz (`setPixel`/`paintLine`/
//     `loadFromImageData`), sin acoplarse al manejo de eventos de mouse
//     del editor.

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

/**
 * Fuente de pixeles minima compatible estructuralmente con un
 * `ImageData` del DOM (y con un objeto plano en tests) -- ver
 * `loadFromImageData`.
 */
export interface PixelSource {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * Interpola una linea entre dos celdas de cuadricula (algoritmo de
 * Bresenham, solo enteros) e incluye ambos extremos. Se usa para que el
 * modo brocha (arrastrar el mouse) no "salte" pixeles cuando el cursor
 * se mueve mas rapido que la frecuencia de eventos `pointermove` --
 * HU-2, criterio de aceptacion del modo brocha.
 */
export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): PixelPoint[] {
  const points: PixelPoint[] = [];

  let x = Math.round(x0);
  let y = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);

  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const sx = x < endX ? 1 : -1;
  const sy = y < endY ? 1 : -1;
  let err = dx + dy;

  // Limite defensivo: nunca deberia hacer falta mas pasos que el largo
  // Chebyshev de la linea + 1, pero evita un loop infinito si algun dia
  // se cuela una entrada no entera/NaN.
  const maxSteps = Math.max(dx, -dy) + 2;
  let steps = 0;

  while (steps <= maxSteps) {
    points.push({ x, y });
    if (x === endX && y === endY) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    steps += 1;
  }

  return points;
}

export class TextureBuffer {
  readonly width: number;
  readonly height: number;
  private readonly data: Uint8ClampedArray;

  constructor(width: number, height: number, initialData?: Uint8ClampedArray) {
    if (width <= 0 || height <= 0) {
      throw new RangeError(`TextureBuffer: dimensiones invalidas (${width}x${height}).`);
    }
    this.width = width;
    this.height = height;

    const expectedLength = width * height * 4;
    if (initialData) {
      if (initialData.length !== expectedLength) {
        throw new RangeError(
          `TextureBuffer: initialData.length (${initialData.length}) no corresponde a ${width}x${height} RGBA (${expectedLength}).`,
        );
      }
      this.data = new Uint8ClampedArray(initialData);
    } else {
      // Uint8ClampedArray se inicializa en ceros -> transparente por
      // default hasta que `loadFromImageData` cargue la textura base
      // real (ver Editor.tsx).
      this.data = new Uint8ClampedArray(expectedLength);
    }
  }

  inBounds(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  private indexOf(x: number, y: number): number {
    return (y * this.width + x) * 4;
  }

  getPixel(x: number, y: number): RGBA {
    if (!this.inBounds(x, y)) {
      throw new RangeError(`TextureBuffer.getPixel: (${x},${y}) fuera de rango (${this.width}x${this.height}).`);
    }
    const i = this.indexOf(x, y);
    return { r: this.data[i], g: this.data[i + 1], b: this.data[i + 2], a: this.data[i + 3] };
  }

  /**
   * Pinta un pixel. Fuera de rango es un no-op seguro (devuelve
   * `false`) -- el modo brocha puede generar celdas fuera de la
   * cuadricula si el cursor sale del canvas mientras se arrastra (ver
   * `TextureEditor`), y no debe lanzar por eso.
   */
  setPixel(x: number, y: number, color: RGBA): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = this.indexOf(x, y);
    this.data[i] = color.r;
    this.data[i + 1] = color.g;
    this.data[i + 2] = color.b;
    this.data[i + 3] = color.a;
    return true;
  }

  /**
   * Pinta todas las celdas entre `(x0,y0)` y `(x1,y1)` (inclusive),
   * interpolando con `bresenhamLine` -- modo brocha (HU-2). Devuelve
   * las celdas efectivamente pintadas (dentro de rango), para que el
   * llamador sepa si hubo cambio real (y por ejemplo evite re-renderizar
   * si no lo hubo).
   */
  paintLine(x0: number, y0: number, x1: number, y1: number, color: RGBA): PixelPoint[] {
    const painted: PixelPoint[] = [];
    for (const p of bresenhamLine(x0, y0, x1, y1)) {
      if (this.setPixel(p.x, p.y, color)) painted.push(p);
    }
    return painted;
  }

  /**
   * Reemplaza todo el contenido del buffer (ej. carga inicial de la
   * textura base servida por el backend -- ver `decodeTexture.ts` +
   * `Editor.tsx`). Muta in-place (mantiene la misma instancia/referencia
   * de `TextureBuffer`) para no forzar a los consumidores a re-suscribirse.
   */
  loadFromImageData(source: PixelSource): void {
    if (source.width !== this.width || source.height !== this.height) {
      throw new RangeError(
        `TextureBuffer.loadFromImageData: se esperaba ${this.width}x${this.height}, se recibio ${source.width}x${source.height}.`,
      );
    }
    this.data.set(source.data);
  }

  /** Copia de solo lectura de los bytes RGBA crudos (para debugging/tests). */
  getRawData(): Uint8ClampedArray {
    return new Uint8ClampedArray(this.data);
  }

  /** Construye un `ImageData` real (DOM) a partir del estado actual -- para pintarlo en un `<canvas>`. */
  toImageData(): ImageData {
    return new ImageData(new Uint8ClampedArray(this.data), this.width, this.height);
  }
}
