// Búsqueda de los mobs DENTRO de un proyecto (ticket 057, "Proyecto" ->
// tarjetas de mob) -- mismo criterio de módulo PURO/testeable ya
// establecido por `projectFilter.ts` (búsqueda de proyectos en "Mis
// proyectos", ticket 028). A diferencia de `projectFilter.ts`, no hay
// un "orden por fecha" real disponible aquí -- un `ProjectMobEntry`
// (`projectStorage.ts`) no tiene su propio `updatedAt` (solo el
// proyecto completo lo tiene), así que el único orden con sentido es
// alfabético por nombre de mob, siempre -- no se expone como opción de
// usuario (un `<select>` de una sola opción no aportaría nada, ver
// `docs/definiciones/preview-2d-y-rediseno-proyecto.md`).

import type { MobSummary } from './types/mobs';

/** Nombre legible de un mob a partir de su id -- mismo criterio que `MisProyectos.tsx`/`Proyecto.tsx`. */
function mobLabelFor(mobId: string, mobs: MobSummary[]): string {
  return mobs.find((m) => m.id === mobId)?.label ?? mobId;
}

/**
 * Filtra `mobIds` por substring del nombre legible (case-insensitive) y
 * los devuelve ordenados alfabéticamente por ese mismo nombre -- 100%
 * client-side, sin releer `localStorage` (`mobIds` ya viene de
 * `Object.keys(record.mobs)`, ver `Proyecto.tsx`).
 */
export function filterAndSortProjectMobs(mobIds: string[], mobs: MobSummary[], searchText: string): string[] {
  const needle = searchText.trim().toLowerCase();
  const filtered = needle ? mobIds.filter((mobId) => mobLabelFor(mobId, mobs).toLowerCase().includes(needle)) : mobIds;
  return [...filtered].sort((a, b) => mobLabelFor(a, mobs).localeCompare(mobLabelFor(b, mobs)));
}
