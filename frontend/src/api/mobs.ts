import type { MobSummary, MobsResponse } from '../types/mobs';

/**
 * Consume `GET /api/mobs` (ticket 016) -- catalogo de mobs soportados
 * por el backend, para el menu de seleccion (ticket 018, `MobSelector`).
 * Deliberadamente NO hardcodea ninguna lista de mobs en el frontend: el
 * menu muestra exactamente lo que este endpoint devuelva en ese momento
 * (hoy Esqueleto y Zombie; Araña/Creeper se agregaran solos cuando el
 * backend los registre, sin tocar este archivo ni `MobSelector`).
 */
export async function fetchMobs(): Promise<MobSummary[]> {
  const res = await fetch('/api/mobs');
  if (!res.ok) {
    throw new Error(`No se pudo cargar el catálogo de mobs (HTTP ${res.status})`);
  }
  const body = (await res.json()) as MobsResponse;
  return body.mobs;
}
