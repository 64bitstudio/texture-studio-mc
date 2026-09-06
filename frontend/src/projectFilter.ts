// Búsqueda/filtro/orden de la lista de "Guardados" (ticket 028, HU-2).
// Deliberadamente puro -- sin React/DOM -- mismo criterio de
// testabilidad que `textureBuffer.ts`/`symmetry.ts` (ver
// `frontend/test/projectFilter.spec.ts`). Opera 100% en memoria sobre
// el array que ya devuelve `projectStorage.listProjects()` -- ningún
// cambio al esquema de `localStorage` ni una segunda lectura (ver
// `docs/definiciones/rediseno-ux-ui-y-navegacion.md`, "Diseño técnico",
// "Pantalla de Guardados: filtro/orden 100% client-side").

import type { ProjectSummary } from './projectStorage';

export type ProjectSortBy = 'updatedAt' | 'name';

export interface ProjectFilterOptions {
  /** Substring, sin distinguir mayúsculas/minúsculas, contra `project.name`. Vacío/undefined = sin filtro. */
  searchText?: string;
  /** `null`/undefined = sin filtro por mob. */
  mobId?: string | null;
  /** `'updatedAt'` (default, más reciente primero) o `'name'` (alfabético). */
  sortBy?: ProjectSortBy;
}

/**
 * Filtra por nombre (substring) y por mob contenido, luego ordena.
 * `projects` ya viene de `listProjects()` (orden `updatedAt` descendente
 * por default) -- este modulo no vuelve a leer `localStorage`, solo
 * transforma el array recibido.
 */
export function filterAndSortProjects(projects: ProjectSummary[], options: ProjectFilterOptions = {}): ProjectSummary[] {
  const { searchText, mobId, sortBy = 'updatedAt' } = options;
  const needle = searchText?.trim().toLowerCase();

  let result = projects;

  if (needle) {
    result = result.filter((p) => p.name.toLowerCase().includes(needle));
  }

  if (mobId) {
    result = result.filter((p) => p.mobIds.includes(mobId));
  }

  if (sortBy === 'name') {
    result = [...result].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // `updatedAt` descendente -- mismo criterio que `listProjects()`, se
    // re-ordena explicitamente aca (no solo se confia en el orden de
    // entrada) porque el filtro de arriba no garantiza preservar el
    // orden relativo si en el futuro `listProjects()` cambiara su
    // propio orden por defecto.
    result = [...result].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  return result;
}

/** Catálogo de mobs presentes en AL MENOS un proyecto guardado -- para poblar el `<select>` de filtro sin ofrecer mobs que ningún proyecto contiene. */
export function collectMobIdsInProjects(projects: ProjectSummary[]): string[] {
  const seen = new Set<string>();
  for (const project of projects) {
    for (const mobId of project.mobIds) {
      seen.add(mobId);
    }
  }
  return Array.from(seen).sort();
}
