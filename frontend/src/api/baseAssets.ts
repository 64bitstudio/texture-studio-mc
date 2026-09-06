import type { MobBaseAssetsResponse } from '../types/baseAssets';

/**
 * Consume `GET /api/base-assets/:mobId` (ticket 016 generaliza el
 * endpoint literal `/api/base-assets/skeleton` del ticket 001). En dev
 * local (`npm run dev` de Vite en :5173), el backend corre aparte en
 * :3000 -- ver `vite.config.ts` (proxy de `/api`) y `docs/README.md`.
 * En produccion el backend sirve el frontend, asi que la misma ruta
 * relativa funciona sin proxy.
 *
 * Ticket 018: gana el parametro `mobId` (antes literal a `'skeleton'`)
 * para que el selector de mob pueda pedir el asset de CUALQUIER mob del
 * catalogo de `GET /api/mobs`, sin cambio de contrato HTTP.
 */
export async function fetchMobBaseAssets(mobId: string): Promise<MobBaseAssetsResponse> {
  const res = await fetch(`/api/base-assets/${encodeURIComponent(mobId)}`);
  if (!res.ok) {
    throw new Error(`No se pudo cargar el asset base del mob "${mobId}" (HTTP ${res.status})`);
  }
  return (await res.json()) as MobBaseAssetsResponse;
}
