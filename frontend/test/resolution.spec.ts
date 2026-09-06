import { describe, expect, it } from 'vitest';
import { RESOLUTION_MAX, RESOLUTION_MIN, clampResolutionMultiplier, resamplePixelSource } from '../src/resolution';
import type { PixelSource } from '../src/textureBuffer';

/** Crea un `PixelSource` 2x2 con un color distinto por celda -- util para verificar "que pixel gana" al escalar. */
function makeSource2x2(): PixelSource {
  // (0,0)=rojo (1,0)=verde (0,1)=azul (1,1)=blanco
  const data = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 255, 255,
  ]);
  return { width: 2, height: 2, data };
}

function pixelAt(source: PixelSource, x: number, y: number): [number, number, number, number] {
  const i = (y * source.width + x) * 4;
  return [source.data[i], source.data[i + 1], source.data[i + 2], source.data[i + 3]];
}

describe('clampResolutionMultiplier', () => {
  it('recorta al rango [1,10]', () => {
    expect(clampResolutionMultiplier(0)).toBe(RESOLUTION_MIN);
    expect(clampResolutionMultiplier(-5)).toBe(RESOLUTION_MIN);
    expect(clampResolutionMultiplier(11)).toBe(RESOLUTION_MAX);
    expect(clampResolutionMultiplier(1000)).toBe(RESOLUTION_MAX);
  });

  it('redondea valores no enteros', () => {
    expect(clampResolutionMultiplier(3.4)).toBe(3);
    expect(clampResolutionMultiplier(3.6)).toBe(4);
  });

  it('deja pasar cualquier entero dentro de rango tal cual', () => {
    for (let n = RESOLUTION_MIN; n <= RESOLUTION_MAX; n++) {
      expect(clampResolutionMultiplier(n)).toBe(n);
    }
  });
});

describe('resamplePixelSource', () => {
  it('mismas dimensiones -- devuelve una copia con el mismo contenido (no la misma referencia de datos)', () => {
    const source = makeSource2x2();
    const result = resamplePixelSource(source, 2, 2);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(Array.from(result.data)).toEqual(Array.from(source.data));
    expect(result.data).not.toBe(source.data);
  });

  it('escalar hacia arriba (x1 -> x4, HU explicita del ticket 009): cada pixel origen se convierte en un bloque N×N identico', () => {
    const source = makeSource2x2();
    const result = resamplePixelSource(source, 8, 8); // factor 4 en cada eje

    expect(result.width).toBe(8);
    expect(result.height).toBe(8);

    // El bloque 4x4 superior-izquierdo entero debe ser el color de (0,0) del origen: rojo.
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        expect(pixelAt(result, x, y)).toEqual([255, 0, 0, 255]);
      }
    }
    // El bloque 4x4 superior-derecho entero debe ser el color de (1,0): verde.
    for (let y = 0; y < 4; y++) {
      for (let x = 4; x < 8; x++) {
        expect(pixelAt(result, x, y)).toEqual([0, 255, 0, 255]);
      }
    }
    // El bloque 4x4 inferior-izquierdo entero debe ser el color de (0,1): azul.
    for (let y = 4; y < 8; y++) {
      for (let x = 0; x < 4; x++) {
        expect(pixelAt(result, x, y)).toEqual([0, 0, 255, 255]);
      }
    }
    // El bloque 4x4 inferior-derecho entero debe ser el color de (1,1): blanco.
    for (let y = 4; y < 8; y++) {
      for (let x = 4; x < 8; x++) {
        expect(pixelAt(result, x, y)).toEqual([255, 255, 255, 255]);
      }
    }
  });

  it('escalar hacia abajo (x4 -> x1): nunca produce un color mezclado/promediado entre pixeles del bloque de origen', () => {
    // Bloque solido de 4x4 rojo arriba-izquierda, resto un patron distinto,
    // para verificar que el downscale toma UN pixel real del bloque, no un promedio.
    const width = 8;
    const height = 8;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const isTopLeftBlock = x < 4 && y < 4;
        data[i] = isTopLeftBlock ? 255 : 0;
        data[i + 1] = isTopLeftBlock ? 0 : 255;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
    const source: PixelSource = { width, height, data };
    const result = resamplePixelSource(source, 2, 2);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);

    const validColors = [
      [255, 0, 0, 255],
      [0, 255, 0, 255],
    ];
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        const color = pixelAt(result, x, y);
        // Nunca un valor intermedio (ej. 127) producto de promediar -- siempre uno de los dos colores reales del bloque origen.
        expect(validColors).toContainEqual(color);
      }
    }
    // El pixel destino (0,0) cae en el bloque top-left (todo rojo) -- debe ser rojo.
    expect(pixelAt(result, 0, 0)).toEqual([255, 0, 0, 255]);
    // El pixel destino (1,1) cae en el bloque inferior-derecho (todo verde) -- debe ser verde.
    expect(pixelAt(result, 1, 1)).toEqual([0, 255, 0, 255]);
  });

  it('preserva el contenido pintado al hacer un roundtrip x1 -> x4 -> x1 sobre un bloque solido', () => {
    const source = makeSource2x2();
    const up = resamplePixelSource(source, 8, 8);
    const down = resamplePixelSource(up, 2, 2);
    // Cada celda 2x2 del origen era un color solido -> al subir y volver a
    // bajar, cada bloque N×N sigue siendo un unico color, asi que el
    // roundtrip debe reproducir exactamente el contenido original.
    expect(Array.from(down.data)).toEqual(Array.from(source.data));
  });
});
