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
  listProjects,
  loadProject,
  projectExists,
  saveProject,
} from '../src/projectStorage';

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
