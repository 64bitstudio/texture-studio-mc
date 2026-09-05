import { describe, expect, it } from 'vitest';
import {
  buildPackMcmeta,
  buildResourcePackFiles,
  DEFAULT_PACK_DESCRIPTION,
  PACK_MCMETA_PATH,
  RESOURCE_PACK_FORMAT,
  SKELETON_PNG_PATH,
} from '../src/exportPack';

describe('buildPackMcmeta', () => {
  it('usa RESOURCE_PACK_FORMAT (75) en los 3 campos exigidos por Minecraft -- gotcha de mc_texture.py', () => {
    const mcmeta = buildPackMcmeta();
    expect(mcmeta.pack.pack_format).toBe(75);
    expect(mcmeta.pack.min_format).toBe(75);
    expect(mcmeta.pack.max_format).toBe(75);
    expect(RESOURCE_PACK_FORMAT).toBe(75);
  });

  it('usa la descripcion por defecto cuando no se pasa una', () => {
    const mcmeta = buildPackMcmeta();
    expect(mcmeta.pack.description).toBe(DEFAULT_PACK_DESCRIPTION);
  });

  it('usa la descripcion dada cuando se especifica', () => {
    const mcmeta = buildPackMcmeta('Mi pack custom');
    expect(mcmeta.pack.description).toBe('Mi pack custom');
    // el resto de campos no cambia por tener una descripcion distinta
    expect(mcmeta.pack.pack_format).toBe(75);
    expect(mcmeta.pack.min_format).toBe(75);
    expect(mcmeta.pack.max_format).toBe(75);
  });

  it('produce exactamente el shape { pack: { pack_format, min_format, max_format, description } }, sin campos extra', () => {
    const mcmeta = buildPackMcmeta('desc');
    expect(mcmeta).toEqual({
      pack: {
        pack_format: 75,
        min_format: 75,
        max_format: 75,
        description: 'desc',
      },
    });
    expect(Object.keys(mcmeta)).toEqual(['pack']);
    expect(Object.keys(mcmeta.pack)).toEqual(['pack_format', 'min_format', 'max_format', 'description']);
  });

  it('supported_formats NUNCA se incluye (retirado en 25w31a, no usar para packs nuevos)', () => {
    const mcmeta = buildPackMcmeta();
    expect('supported_formats' in mcmeta.pack).toBe(false);
  });
});

describe('buildResourcePackFiles', () => {
  it('devuelve exactamente 2 archivos: pack.mcmeta y la ruta vanilla del skeleton.png', () => {
    const pngBytes = new Uint8Array([1, 2, 3, 4]);
    const files = buildResourcePackFiles(pngBytes);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.path)).toEqual([PACK_MCMETA_PATH, SKELETON_PNG_PATH]);
  });

  it('la ruta del PNG es exactamente assets/minecraft/textures/entity/skeleton/skeleton.png', () => {
    const files = buildResourcePackFiles(new Uint8Array([1]));
    expect(SKELETON_PNG_PATH).toBe('assets/minecraft/textures/entity/skeleton/skeleton.png');
    expect(files[1].path).toBe('assets/minecraft/textures/entity/skeleton/skeleton.png');
  });

  it('pack.mcmeta serializa el JSON exacto de buildPackMcmeta (parseable y con los 3 campos en 75)', () => {
    const files = buildResourcePackFiles(new Uint8Array([1]), 'Descripcion de prueba');
    const mcmetaFile = files.find((f) => f.path === PACK_MCMETA_PATH);
    expect(mcmetaFile).toBeDefined();
    const parsed = JSON.parse(mcmetaFile!.data as string);
    expect(parsed).toEqual({
      pack: {
        pack_format: 75,
        min_format: 75,
        max_format: 75,
        description: 'Descripcion de prueba',
      },
    });
  });

  it('no altera ni copia los bytes del PNG -- pasa exactamente la misma referencia recibida (no duplica la fuente de verdad)', () => {
    const pngBytes = new Uint8Array([9, 8, 7, 6, 5]);
    const files = buildResourcePackFiles(pngBytes);
    const pngFile = files.find((f) => f.path === SKELETON_PNG_PATH);
    expect(pngFile?.data).toBe(pngBytes);
  });

  it('usa la descripcion por defecto cuando no se especifica', () => {
    const files = buildResourcePackFiles(new Uint8Array([1]));
    const mcmetaFile = files.find((f) => f.path === PACK_MCMETA_PATH);
    const parsed = JSON.parse(mcmetaFile!.data as string);
    expect(parsed.pack.description).toBe(DEFAULT_PACK_DESCRIPTION);
  });
});
