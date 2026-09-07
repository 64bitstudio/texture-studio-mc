import { useEffect, useState } from 'react';
import { fetchMobBaseAssets } from '../api/baseAssets';
import type { MobGeometry } from '../types/baseAssets';

/**
 * Geometría de UN mob, con cache COMPARTIDA entre todas las tarjetas de
 * una misma pantalla (mismo `Map` pasado por props -- mismo criterio de
 * `geometryCache` ya establecido en el ticket 055, `Proyecto.tsx`).
 * Extraído de `MobEntryCard.tsx` (ticket 073) para reusarlo también en
 * `ProjectCard.tsx` (miniaturas reales de "Mis proyectos") sin duplicar
 * la lógica de fetch+cache.
 *
 * Devuelve `null` mientras la geometría no está lista -- quien use este
 * hook decide qué mostrar mientras tanto (ej. la textura cruda sin
 * componer, ver `useMobSnapshot3D`).
 */
export function useMobGeometry(mobId: string, geometryCache: Map<string, MobGeometry>): MobGeometry | null {
  const cachedGeometry = geometryCache.get(mobId) ?? null;
  const [fetchedGeometry, setFetchedGeometry] = useState<MobGeometry | null>(null);
  const geometry = cachedGeometry ?? fetchedGeometry;

  useEffect(() => {
    if (geometryCache.has(mobId)) return;
    let cancelled = false;
    fetchMobBaseAssets(mobId)
      .then((asset) => {
        geometryCache.set(mobId, asset.geometry);
        if (!cancelled) setFetchedGeometry(asset.geometry);
      })
      .catch((err: unknown) => {
        console.warn(`useMobGeometry: no se pudo cargar la geometría de "${mobId}".`, err);
      });
    return () => {
      cancelled = true;
    };
  }, [mobId, geometryCache]);

  return geometry;
}
