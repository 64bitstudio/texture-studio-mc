import { describe, expect, it } from 'vitest';
import { filterAndSortProjectMobs } from '../src/projectMobFilter';
import type { MobSummary } from '../src/types/mobs';

const MOBS: MobSummary[] = [
  { id: 'skeleton', label: 'Esqueleto' },
  { id: 'zombie', label: 'Zombie' },
  { id: 'creeper', label: 'Creeper' },
  { id: 'spider', label: 'Araña' },
];

describe('filterAndSortProjectMobs', () => {
  it('sin texto de búsqueda, devuelve todos ordenados alfabéticamente por nombre legible', () => {
    expect(filterAndSortProjectMobs(['zombie', 'skeleton', 'creeper'], MOBS, '')).toEqual(['creeper', 'skeleton', 'zombie']);
  });

  it('filtra por substring, case-insensitive', () => {
    expect(filterAndSortProjectMobs(['zombie', 'skeleton', 'creeper'], MOBS, 'ESQUE')).toEqual(['skeleton']);
  });

  it('ningún mob coincide -> array vacío', () => {
    expect(filterAndSortProjectMobs(['zombie', 'skeleton'], MOBS, 'araña')).toEqual([]);
  });

  it('un mob sin entrada en el catálogo cae a su propio id (mismo criterio que mobLabelFor de Proyecto.tsx/MisProyectos.tsx)', () => {
    expect(filterAndSortProjectMobs(['ghost'], MOBS, '')).toEqual(['ghost']);
  });
});
