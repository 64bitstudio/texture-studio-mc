import { describe, expect, it } from 'vitest';
import { collectMobIdsInProjects, filterAndSortProjects } from '../src/projectFilter';
import type { ProjectSummary } from '../src/projectStorage';

const PROJECTS: ProjectSummary[] = [
  { name: 'Set Nether', updatedAt: '2026-06-01T00:00:00.000Z', mobIds: ['skeleton', 'zombie'] },
  { name: 'Araña rara', updatedAt: '2026-06-03T00:00:00.000Z', mobIds: ['spider'] },
  { name: 'zombie clasico', updatedAt: '2026-06-02T00:00:00.000Z', mobIds: ['zombie'] },
];

describe('filterAndSortProjects', () => {
  it('sin opciones, devuelve todo ordenado por fecha descendente (default)', () => {
    const result = filterAndSortProjects(PROJECTS);
    expect(result.map((p) => p.name)).toEqual(['Araña rara', 'zombie clasico', 'Set Nether']);
  });

  it('filtra por NOMBRE (substring, sin distinguir mayusculas/minusculas) -- no por contenido de mobIds', () => {
    // "Set Nether" contiene 'zombie' en `mobIds`, pero NO en su nombre --
    // debe quedar excluido (la busqueda es por nombre, no por mob).
    const result = filterAndSortProjects(PROJECTS, { searchText: 'ZOMBIE' });
    expect(result.map((p) => p.name)).toEqual(['zombie clasico']);
  });

  it('un searchText vacio/solo espacios no filtra nada', () => {
    expect(filterAndSortProjects(PROJECTS, { searchText: '   ' })).toHaveLength(3);
  });

  it('filtra por mob contenido', () => {
    const result = filterAndSortProjects(PROJECTS, { mobId: 'skeleton' });
    expect(result.map((p) => p.name)).toEqual(['Set Nether']);
  });

  it('mobId null/undefined no filtra nada', () => {
    expect(filterAndSortProjects(PROJECTS, { mobId: null })).toHaveLength(3);
  });

  it('combina busqueda por nombre Y filtro por mob (AND, no OR)', () => {
    // "Set Nether" matchea el nombre Y contiene 'skeleton'; "zombie
    // clasico" contiene 'zombie' en el nombre pero NO en mobIds -- debe
    // quedar excluido (si fuera OR, aparecerian ambos).
    const result = filterAndSortProjects(PROJECTS, { searchText: 'et', mobId: 'skeleton' });
    expect(result.map((p) => p.name)).toEqual(['Set Nether']);
  });

  it('ordena por nombre (alfabetico) cuando se pide sortBy: "name"', () => {
    const result = filterAndSortProjects(PROJECTS, { sortBy: 'name' });
    expect(result.map((p) => p.name)).toEqual(['Araña rara', 'Set Nether', 'zombie clasico']);
  });

  it('no muta el array recibido', () => {
    const copy = [...PROJECTS];
    filterAndSortProjects(PROJECTS, { sortBy: 'name' });
    expect(PROJECTS).toEqual(copy);
  });
});

describe('collectMobIdsInProjects', () => {
  it('devuelve los mobIds unicos presentes en al menos un proyecto, ordenados', () => {
    expect(collectMobIdsInProjects(PROJECTS)).toEqual(['skeleton', 'spider', 'zombie']);
  });

  it('devuelve vacio si no hay proyectos', () => {
    expect(collectMobIdsInProjects([])).toEqual([]);
  });
});
