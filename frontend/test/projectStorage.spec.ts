// Ticket 019 -- guardar/cargar/listar/eliminar proyectos.
//
// `projectStorage.ts` usa `globalThis.localStorage` (no `window.localStorage`
// -- ver el comentario de ese archivo) precisamente para poder mockearlo
// aca: el entorno de test de este proyecto es `environment: 'node'`
// (ver `vitest.config.ts`), sin `window` ni un `localStorage` real. Se
// implementa un mock minimo (misma superficie que usa el modulo:
// `getItem`/`setItem`) en vez de una libreria de terceros -- no hace
// falta mas para estos tests.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProjectAlreadyExistsError,
  PROJECTS_STORAGE_KEY,
  deleteAllProjects,
  deleteProject,
  duplicateProject,
  getMobGeometryStatus,
  listProjects,
  loadProject,
  projectExists,
  renameProject,
  removeMobFromProject,
  saveProject,
  updateMobGeometry,
  updateProjectCover,
  updateProjectDescription,
} from '../src/projectStorage';
import type { MobGeometry } from '../src/types/baseAssets';

class MockStorage implements Storage {
  private store = new Map<string, string>();
  // No usado por `projectStorage.ts` -- se implementa solo para
  // satisfacer la interfaz `Storage` completa de TypeScript.
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

const SAMPLE_MOBS = { skeleton: { resolution: 1, pngDataUrl: 'data:image/png;base64,AAA' } };

beforeEach(() => {
  globalThis.localStorage = new MockStorage();
});

describe('saveProject / loadProject', () => {
  it('guarda un proyecto nuevo y lo recupera con exactamente los mismos datos por mob', () => {
    saveProject('prueba-1', SAMPLE_MOBS);

    const loaded = loadProject('prueba-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.mobs).toEqual(SAMPLE_MOBS);
    expect(typeof loaded!.updatedAt).toBe('string');
  });

  it('guarda multiples mobs dentro del mismo proyecto (HU-3, "varios mobs a la vez")', () => {
    const mobs = {
      zombie: { resolution: 4, pngDataUrl: 'data:image/png;base64,ZZZ' },
      skeleton: { resolution: 1, pngDataUrl: 'data:image/png;base64,SSS' },
    };
    saveProject('Set Nether', mobs);

    const loaded = loadProject('Set Nether');
    expect(loaded!.mobs).toEqual(mobs);
  });

  it('devuelve null al cargar un nombre que nunca existio', () => {
    expect(loadProject('no-existe')).toBeNull();
  });

  it('rechaza un nombre vacio o solo espacios', () => {
    expect(() => saveProject('', SAMPLE_MOBS)).toThrow(RangeError);
    expect(() => saveProject('   ', SAMPLE_MOBS)).toThrow(RangeError);
  });

  it('rechaza guardar sin ningun mob con contenido', () => {
    expect(() => saveProject('vacio', {})).toThrow(RangeError);
  });

  it('recorta espacios del nombre antes de guardar', () => {
    saveProject('  con espacios  ', SAMPLE_MOBS);
    expect(loadProject('con espacios')).not.toBeNull();
  });
});

describe('saveProject -- nunca sobrescribe en silencio (HU-3)', () => {
  it('lanza ProjectAlreadyExistsError si el nombre ya existe y no se pasa overwrite', () => {
    saveProject('prueba-1', SAMPLE_MOBS);
    expect(() => saveProject('prueba-1', SAMPLE_MOBS)).toThrow(ProjectAlreadyExistsError);

    // El intento fallido no debe haber alterado el proyecto existente.
    const loaded = loadProject('prueba-1');
    expect(loaded!.mobs).toEqual(SAMPLE_MOBS);
  });

  it('sobrescribe correctamente cuando se pasa overwrite: true', () => {
    saveProject('prueba-1', SAMPLE_MOBS);
    const nuevosMobs = { skeleton: { resolution: 2, pngDataUrl: 'data:image/png;base64,BBB' } };

    saveProject('prueba-1', nuevosMobs, { overwrite: true });

    expect(loadProject('prueba-1')!.mobs).toEqual(nuevosMobs);
  });
});

describe('projectExists', () => {
  it('distingue proyectos existentes de inexistentes', () => {
    expect(projectExists('prueba-1')).toBe(false);
    saveProject('prueba-1', SAMPLE_MOBS);
    expect(projectExists('prueba-1')).toBe(true);
  });
});

describe('listProjects', () => {
  it('lista nombre + fecha de cada proyecto guardado (HU-4)', () => {
    saveProject('a', SAMPLE_MOBS);
    saveProject('b', SAMPLE_MOBS);

    const list = listProjects();
    expect(list.map((p) => p.name).sort()).toEqual(['a', 'b']);
    for (const p of list) {
      expect(typeof p.updatedAt).toBe('string');
    }
  });

  it('devuelve una lista vacia cuando no hay ningun proyecto guardado', () => {
    expect(listProjects()).toEqual([]);
  });

  it('incluye mobIds -- claves de mobs del proyecto, sin decodificar ningun PNG (ticket 027)', () => {
    saveProject('multimob', { skeleton: SAMPLE_MOBS.skeleton, zombie: { resolution: 2, pngDataUrl: 'data:image/png;base64,BBB' } });

    const [summary] = listProjects();
    expect(summary.mobIds.sort()).toEqual(['skeleton', 'zombie']);
  });

  it('ordena por fecha de actualizacion mas reciente primero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    saveProject('viejo', SAMPLE_MOBS);

    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));
    saveProject('nuevo', SAMPLE_MOBS);
    vi.useRealTimers();

    const list = listProjects();
    expect(list.map((p) => p.name)).toEqual(['nuevo', 'viejo']);
  });
});

describe('deleteProject (HU-5)', () => {
  it('elimina un proyecto guardado -- desaparece de listProjects y de localStorage', () => {
    saveProject('prueba-1', SAMPLE_MOBS);
    expect(projectExists('prueba-1')).toBe(true);

    deleteProject('prueba-1');

    expect(projectExists('prueba-1')).toBe(false);
    expect(loadProject('prueba-1')).toBeNull();
    expect(listProjects()).toEqual([]);

    const raw = JSON.parse(globalThis.localStorage.getItem(PROJECTS_STORAGE_KEY)!) as Record<string, unknown>;
    expect(raw).not.toHaveProperty('prueba-1');
  });

  it('eliminar un nombre inexistente es un no-op seguro (no lanza)', () => {
    expect(() => deleteProject('no-existe')).not.toThrow();
  });

  it('no afecta a otros proyectos guardados', () => {
    saveProject('a', SAMPLE_MOBS);
    saveProject('b', SAMPLE_MOBS);
    deleteProject('a');
    expect(listProjects().map((p) => p.name)).toEqual(['b']);
  });
});

describe('deleteAllProjects (ticket 036)', () => {
  it('borra todos los proyectos guardados de una vez', () => {
    saveProject('a', SAMPLE_MOBS);
    saveProject('b', SAMPLE_MOBS);
    expect(listProjects()).toHaveLength(2);

    deleteAllProjects();

    expect(listProjects()).toEqual([]);
  });

  it('es un no-op seguro si nunca hubo proyectos guardados (no lanza)', () => {
    expect(() => deleteAllProjects()).not.toThrow();
    expect(listProjects()).toEqual([]);
  });

  it('no toca otras claves de localStorage ajenas a los proyectos', () => {
    globalThis.localStorage.setItem('ts-theme', 'light');
    saveProject('a', SAMPLE_MOBS);

    deleteAllProjects();

    expect(globalThis.localStorage.getItem('ts-theme')).toBe('light');
  });
});

describe('renameProject (ticket 041)', () => {
  it('renombra un proyecto -- el contenido se conserva, la clave vieja desaparece', () => {
    saveProject('nombre-viejo', SAMPLE_MOBS);

    renameProject('nombre-viejo', 'nombre-nuevo');

    expect(projectExists('nombre-viejo')).toBe(false);
    expect(projectExists('nombre-nuevo')).toBe(true);
    expect(loadProject('nombre-nuevo')!.mobs).toEqual(SAMPLE_MOBS);
  });

  it('no altera updatedAt (renombrar es metadato, no trabajo hecho)', () => {
    saveProject('a', SAMPLE_MOBS);
    const before = loadProject('a')!.updatedAt;

    renameProject('a', 'b');

    expect(loadProject('b')!.updatedAt).toBe(before);
  });

  it('lanza si el nombre origen no existe', () => {
    expect(() => renameProject('no-existe', 'algo')).toThrow(/ya no existe/);
  });

  it('lanza ProjectAlreadyExistsError si el nombre destino ya existe -- no fusiona ni sobrescribe', () => {
    saveProject('a', SAMPLE_MOBS);
    saveProject('b', SAMPLE_MOBS);

    expect(() => renameProject('a', 'b')).toThrow(ProjectAlreadyExistsError);
    // Ninguno de los dos proyectos originales se toco.
    expect(projectExists('a')).toBe(true);
    expect(projectExists('b')).toBe(true);
  });
});

describe('removeMobFromProject (ticket 058)', () => {
  const TWO_MOBS = {
    skeleton: { resolution: 1, pngDataUrl: 'data:image/png;base64,AAA' },
    zombie: { resolution: 6, pngDataUrl: 'data:image/png;base64,BBB' },
  };

  it('quita solo el mob indicado, sin tocar el resto del proyecto', () => {
    saveProject('a', TWO_MOBS);

    removeMobFromProject('a', 'skeleton');

    expect(loadProject('a')!.mobs).toEqual({ zombie: TWO_MOBS.zombie });
  });

  it('permite dejar el proyecto sin ningún mob (no fuerza eliminar el proyecto completo)', () => {
    saveProject('a', { skeleton: SAMPLE_MOBS.skeleton });

    removeMobFromProject('a', 'skeleton');

    const record = loadProject('a')!;
    expect(record).not.toBeNull();
    expect(record.mobs).toEqual({});
    expect(projectExists('a')).toBe(true);
  });

  it('no-op seguro si el mob no existe en el proyecto', () => {
    saveProject('a', TWO_MOBS);

    expect(() => removeMobFromProject('a', 'creeper')).not.toThrow();
    expect(loadProject('a')!.mobs).toEqual(TWO_MOBS);
  });

  it('no-op seguro si el proyecto no existe', () => {
    expect(() => removeMobFromProject('no-existe', 'skeleton')).not.toThrow();
  });
});

describe('updateProjectDescription (ticket 056)', () => {
  it('guarda la descripción sin tocar updatedAt (metadato, no trabajo hecho)', () => {
    saveProject('a', SAMPLE_MOBS);
    const before = loadProject('a')!.updatedAt;

    updateProjectDescription('a', 'Set inspirado en el Nether.');

    const record = loadProject('a')!;
    expect(record.description).toBe('Set inspirado en el Nether.');
    expect(record.updatedAt).toBe(before);
  });

  it('recorta espacios y guarda una descripción vacía/solo-espacios como undefined', () => {
    saveProject('a', SAMPLE_MOBS);

    updateProjectDescription('a', '   ');

    expect(loadProject('a')!.description).toBeUndefined();
  });

  it('lanza si el proyecto no existe', () => {
    expect(() => updateProjectDescription('no-existe', 'x')).toThrow(/ya no existe/);
  });
});

describe('updateProjectCover (ticket 056)', () => {
  it('guarda la portada sin tocar updatedAt', () => {
    saveProject('a', SAMPLE_MOBS);
    const before = loadProject('a')!.updatedAt;

    updateProjectCover('a', 'data:image/png;base64,abc');

    const record = loadProject('a')!;
    expect(record.coverImageDataUrl).toBe('data:image/png;base64,abc');
    expect(record.updatedAt).toBe(before);
  });

  it('quita la portada con undefined', () => {
    saveProject('a', SAMPLE_MOBS);
    updateProjectCover('a', 'data:image/png;base64,abc');

    updateProjectCover('a', undefined);

    expect(loadProject('a')!.coverImageDataUrl).toBeUndefined();
  });

  it('lanza si el proyecto no existe', () => {
    expect(() => updateProjectCover('no-existe', 'data:image/png;base64,abc')).toThrow(/ya no existe/);
  });
});

describe('duplicateProject (ticket 053)', () => {
  it('crea una copia independiente con nombre autogenerado " (copia)"', () => {
    saveProject('Mobs del Bosque', SAMPLE_MOBS);

    const newName = duplicateProject('Mobs del Bosque');

    expect(newName).toBe('Mobs del Bosque (copia)');
    expect(projectExists('Mobs del Bosque')).toBe(true);
    expect(projectExists('Mobs del Bosque (copia)')).toBe(true);
    expect(loadProject('Mobs del Bosque (copia)')!.mobs).toEqual(SAMPLE_MOBS);
  });

  it('incrementa el sufijo si " (copia)" ya existe -- nunca lanza ProjectAlreadyExistsError por colisión propia', () => {
    saveProject('a', SAMPLE_MOBS);
    duplicateProject('a'); // 'a (copia)'

    const second = duplicateProject('a');

    expect(second).toBe('a (copia 2)');
    expect(projectExists('a (copia)')).toBe(true);
    expect(projectExists('a (copia 2)')).toBe(true);
  });

  it('editar la copia no afecta al original (copia profunda de `mobs`, no una referencia compartida)', () => {
    saveProject('original', SAMPLE_MOBS);
    const copyName = duplicateProject('original');

    const copyRecord = loadProject(copyName)!;
    copyRecord.mobs['nuevo-mob'] = { resolution: 1, pngDataUrl: 'data:image/png;base64,extra' };
    saveProject(copyName, copyRecord.mobs, { overwrite: true });

    expect(loadProject('original')!.mobs).toEqual(SAMPLE_MOBS);
  });

  it('lanza si el proyecto origen no existe', () => {
    expect(() => duplicateProject('no-existe')).toThrow(/ya no existe/);
  });
});

describe('saveProject -- fallo de localStorage.setItem nunca se oculta (ej. QuotaExceededError)', () => {
  it('propaga la excepcion de setItem tal cual, sin atraparla', () => {
    const storage = globalThis.localStorage as MockStorage;
    const quotaError = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw quotaError;
    });

    expect(() => saveProject('prueba-1', SAMPLE_MOBS)).toThrow(quotaError);
  });
});

describe('lectura defensiva de un valor corrupto en localStorage', () => {
  it('listProjects/loadProject no lanzan si el valor guardado no es JSON valido', () => {
    globalThis.localStorage.setItem(PROJECTS_STORAGE_KEY, 'esto no es JSON{{{');

    expect(listProjects()).toEqual([]);
    expect(loadProject('cualquiera')).toBeNull();
  });

  it('listProjects/loadProject no lanzan si el valor guardado es un JSON valido pero no es un objeto de proyectos', () => {
    globalThis.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify([1, 2, 3]));

    expect(listProjects()).toEqual([]);
    expect(loadProject('cualquiera')).toBeNull();
  });
});

// Ticket 082 -- geometryStatus / customGeometry (con jerarquia) / animations
// por mob. Ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.

const FACE_LABELS = { front: 'Frente', back: 'Espalda', top: 'Arriba', bottom: 'Abajo', left: 'Izquierda', right: 'Derecha' };

const SAMPLE_CUSTOM_GEOMETRY: MobGeometry = {
  textureWidth: 64,
  textureHeight: 64,
  parts: {
    body: { size: [8, 12, 4], position: [0, 12, 0], uv: { x: 16, y: 16 }, faceLabels: FACE_LABELS },
    head: { size: [8, 8, 8], position: [0, 24, 0], uv: { x: 0, y: 0 }, faceLabels: FACE_LABELS, parentId: 'body' },
  },
};

const SAMPLE_ANIMATIONS = [
  {
    name: 'idle',
    loop: true,
    length: 1,
    bones: { body: [{ time: 0, rotation: { x: 0, y: 0, z: 0 } }, { time: 1, rotation: { x: 0, y: 0, z: 0 } }] },
  },
];

describe('ProjectMobEntry -- geometryStatus/customGeometry/animations (ticket 082)', () => {
  it('compatibilidad: un mob guardado antes de este ticket (sin geometryStatus) se trata como "vanilla"', () => {
    expect(getMobGeometryStatus(SAMPLE_MOBS.skeleton)).toBe('vanilla');
  });

  it('guarda y recupera un mob con geometria custom (con parentId), animaciones y estado "confirmado" sin perder datos', () => {
    const mobs = {
      zombie: {
        resolution: 1,
        pngDataUrl: 'data:image/png;base64,AAA',
        geometryStatus: 'confirmado' as const,
        customGeometry: SAMPLE_CUSTOM_GEOMETRY,
        animations: SAMPLE_ANIMATIONS,
      },
    };

    saveProject('proyecto-custom', mobs);
    const loaded = loadProject('proyecto-custom')!;

    expect(getMobGeometryStatus(loaded.mobs.zombie!)).toBe('confirmado');
    expect(loaded.mobs.zombie!.customGeometry).toEqual(SAMPLE_CUSTOM_GEOMETRY);
    expect(loaded.mobs.zombie!.customGeometry!.parts.head!.parentId).toBe('body');
    expect(loaded.mobs.zombie!.animations).toEqual(SAMPLE_ANIMATIONS);
  });

  it('un mob en estado "modelando" (geometria en edicion, sin confirmar) tambien persiste correctamente', () => {
    const mobs = {
      creeper: {
        resolution: 1,
        pngDataUrl: 'data:image/png;base64,BBB',
        geometryStatus: 'modelando' as const,
        customGeometry: SAMPLE_CUSTOM_GEOMETRY,
      },
    };

    saveProject('proyecto-en-progreso', mobs);
    expect(getMobGeometryStatus(loadProject('proyecto-en-progreso')!.mobs.creeper!)).toBe('modelando');
  });

  it('un proyecto con mobs mixtos (uno vanilla de siempre, otro custom) guarda cada uno con su propio estado', () => {
    const mobs = {
      skeleton: { resolution: 1, pngDataUrl: 'data:image/png;base64,SSS' },
      zombie: {
        resolution: 1,
        pngDataUrl: 'data:image/png;base64,ZZZ',
        geometryStatus: 'confirmado' as const,
        customGeometry: SAMPLE_CUSTOM_GEOMETRY,
      },
    };

    saveProject('proyecto-mixto', mobs);
    const loaded = loadProject('proyecto-mixto')!;

    expect(getMobGeometryStatus(loaded.mobs.skeleton!)).toBe('vanilla');
    expect(loaded.mobs.skeleton!.customGeometry).toBeUndefined();
    expect(getMobGeometryStatus(loaded.mobs.zombie!)).toBe('confirmado');
  });
});

describe('updateMobGeometry (ticket 083)', () => {
  it('actualiza geometryStatus/customGeometry de un mob existente y refresca updatedAt', async () => {
    saveProject('proyecto-modelo', SAMPLE_MOBS);
    const before = loadProject('proyecto-modelo')!.updatedAt;

    // Pequena espera real para que el ISO string de updatedAt cambie de verdad (resolucion de milisegundos).
    await new Promise((resolve) => setTimeout(resolve, 2));

    updateMobGeometry('proyecto-modelo', 'skeleton', { geometryStatus: 'modelando', customGeometry: SAMPLE_CUSTOM_GEOMETRY });
    const loaded = loadProject('proyecto-modelo')!;

    expect(getMobGeometryStatus(loaded.mobs.skeleton!)).toBe('modelando');
    expect(loaded.mobs.skeleton!.customGeometry).toEqual(SAMPLE_CUSTOM_GEOMETRY);
    expect(loaded.updatedAt).not.toBe(before);
  });

  it('no afecta a otros mobs del mismo proyecto', () => {
    saveProject('proyecto-modelo-2', {
      skeleton: { resolution: 1, pngDataUrl: 'data:image/png;base64,AAA' },
      zombie: { resolution: 1, pngDataUrl: 'data:image/png;base64,ZZZ' },
    });
    updateMobGeometry('proyecto-modelo-2', 'skeleton', { geometryStatus: 'confirmado', customGeometry: SAMPLE_CUSTOM_GEOMETRY });

    const loaded = loadProject('proyecto-modelo-2')!;
    expect(getMobGeometryStatus(loaded.mobs.zombie!)).toBe('vanilla');
  });

  it('lanza si el proyecto ya no existe', () => {
    expect(() => updateMobGeometry('no-existe', 'skeleton', { geometryStatus: 'modelando' })).toThrow(/ya no existe/);
  });

  it('lanza si el mob ya no existe en ese proyecto', () => {
    saveProject('proyecto-modelo-3', SAMPLE_MOBS);
    expect(() => updateMobGeometry('proyecto-modelo-3', 'zombie', { geometryStatus: 'modelando' })).toThrow(/ya no existe/);
  });

  it('ticket 086: "confirmar" guarda de una vez geometryStatus/customGeometry/pngDataUrl/resolution', () => {
    saveProject('proyecto-confirmar', SAMPLE_MOBS);

    updateMobGeometry('proyecto-confirmar', 'skeleton', {
      geometryStatus: 'confirmado',
      customGeometry: SAMPLE_CUSTOM_GEOMETRY,
      pngDataUrl: 'data:image/png;base64,BLANCO',
      resolution: 1,
    });

    const loaded = loadProject('proyecto-confirmar')!.mobs.skeleton!;
    expect(getMobGeometryStatus(loaded)).toBe('confirmado');
    expect(loaded.customGeometry).toEqual(SAMPLE_CUSTOM_GEOMETRY);
    expect(loaded.pngDataUrl).toBe('data:image/png;base64,BLANCO');
    expect(loaded.resolution).toBe(1);
  });
});
