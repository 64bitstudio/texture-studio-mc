import { describe, expect, it } from 'vitest';
import {
  buildPackMcmeta,
  buildResourcePackFiles,
  dataUrlToBytes,
  DEFAULT_PACK_DESCRIPTION,
  entityTexturePngPath,
  PACK_MCMETA_PATH,
  projectZipFilename,
  RESOURCE_PACK_FORMAT,
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

describe('entityTexturePngPath (ticket 044)', () => {
  it('sigue el convenio vanilla assets/minecraft/textures/entity/<mobId>/<mobId>.png para cualquier mob del catalogo', () => {
    expect(entityTexturePngPath('skeleton')).toBe('assets/minecraft/textures/entity/skeleton/skeleton.png');
    expect(entityTexturePngPath('zombie')).toBe('assets/minecraft/textures/entity/zombie/zombie.png');
    expect(entityTexturePngPath('spider')).toBe('assets/minecraft/textures/entity/spider/spider.png');
    expect(entityTexturePngPath('creeper')).toBe('assets/minecraft/textures/entity/creeper/creeper.png');
  });
});

describe('buildResourcePackFiles (ticket 044 -- generalizado a N mobs)', () => {
  it('con un solo mob, devuelve exactamente 2 archivos: pack.mcmeta y la ruta vanilla de ese mob', () => {
    const pngBytes = new Uint8Array([1, 2, 3, 4]);
    const files = buildResourcePackFiles([{ mobId: 'skeleton', pngBytes }]);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.path)).toEqual([PACK_MCMETA_PATH, 'assets/minecraft/textures/entity/skeleton/skeleton.png']);
  });

  it('con varios mobs, devuelve pack.mcmeta + una entrada por mob, cada una en su ruta vanilla real', () => {
    const files = buildResourcePackFiles([
      { mobId: 'skeleton', pngBytes: new Uint8Array([1]) },
      { mobId: 'zombie', pngBytes: new Uint8Array([2]) },
      { mobId: 'creeper', pngBytes: new Uint8Array([3]) },
    ]);
    expect(files).toHaveLength(4);
    expect(files.map((f) => f.path)).toEqual([
      PACK_MCMETA_PATH,
      'assets/minecraft/textures/entity/skeleton/skeleton.png',
      'assets/minecraft/textures/entity/zombie/zombie.png',
      'assets/minecraft/textures/entity/creeper/creeper.png',
    ]);
  });

  it('con mobs vacio, devuelve unicamente pack.mcmeta', () => {
    const files = buildResourcePackFiles([]);
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe(PACK_MCMETA_PATH);
  });

  it('pack.mcmeta serializa el JSON exacto de buildPackMcmeta (parseable y con los 3 campos en 75)', () => {
    const files = buildResourcePackFiles([{ mobId: 'skeleton', pngBytes: new Uint8Array([1]) }], 'Descripcion de prueba');
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

  it('no altera ni copia los bytes de cada PNG -- pasa exactamente la misma referencia recibida (no duplica la fuente de verdad)', () => {
    const pngBytes = new Uint8Array([9, 8, 7, 6, 5]);
    const files = buildResourcePackFiles([{ mobId: 'zombie', pngBytes }]);
    const pngFile = files.find((f) => f.path === 'assets/minecraft/textures/entity/zombie/zombie.png');
    expect(pngFile?.data).toBe(pngBytes);
  });

  it('usa la descripcion por defecto cuando no se especifica', () => {
    const files = buildResourcePackFiles([{ mobId: 'skeleton', pngBytes: new Uint8Array([1]) }]);
    const mcmetaFile = files.find((f) => f.path === PACK_MCMETA_PATH);
    const parsed = JSON.parse(mcmetaFile!.data as string);
    expect(parsed.pack.description).toBe(DEFAULT_PACK_DESCRIPTION);
  });
});

describe('dataUrlToBytes (ticket 044)', () => {
  it('decodifica un data URL base64 a los bytes exactos originales', () => {
    // "hola" en base64 es "aG9sYQ==" -> bytes [104, 111, 108, 97]
    const bytes = dataUrlToBytes('data:image/png;base64,aG9sYQ==');
    expect(Array.from(bytes)).toEqual([104, 111, 108, 97]);
  });

  it('produce los mismos bytes que produjo btoa/atob de un string binario conocido (round-trip)', () => {
    const original = new Uint8Array([0, 1, 2, 254, 255, 128, 64]);
    const binaryString = String.fromCharCode(...original);
    const base64 = btoa(binaryString);
    const bytes = dataUrlToBytes(`data:image/png;base64,${base64}`);
    expect(Array.from(bytes)).toEqual(Array.from(original));
  });

  it('lanza un error claro si el string no es un data URL', () => {
    expect(() => dataUrlToBytes('no-es-un-data-url')).toThrow(/data URL/);
  });
});

describe('projectZipFilename (ticket 044)', () => {
  it('convierte el nombre del proyecto a un slug en minusculas separado por guiones', () => {
    expect(projectZipFilename('Set Nether')).toBe('set-nether-resource-pack.zip');
  });

  it('quita acentos', () => {
    expect(projectZipFilename('Ganadería Épica')).toBe('ganaderia-epica-resource-pack.zip');
  });

  it('colapsa caracteres no alfanumericos consecutivos en un solo guion, sin guiones al inicio/fin', () => {
    expect(projectZipFilename('  Mi Proyecto!! (v2) ')).toBe('mi-proyecto-v2-resource-pack.zip');
  });

  it('cae a "proyecto" si el nombre queda vacio tras normalizar', () => {
    expect(projectZipFilename('🎮🎮🎮')).toBe('proyecto-resource-pack.zip');
  });
});
