import type { SkeletonBaseAssetsResponse } from '../types/baseAssets';

/**
 * Consume `GET /api/base-assets/skeleton`. En dev local (`npm run dev`
 * de Vite en :5173), el backend corre aparte en :3000 -- ver
 * `vite.config.ts` (proxy de `/api`) y `docs/README.md`. En produccion
 * el backend sirve el frontend, asi que la misma ruta relativa
 * funciona sin proxy.
 */
export async function fetchSkeletonBaseAssets(): Promise<SkeletonBaseAssetsResponse> {
  const res = await fetch('/api/base-assets/skeleton');
  if (!res.ok) {
    throw new Error(`No se pudo cargar el asset base del Esqueleto (HTTP ${res.status})`);
  }
  return (await res.json()) as SkeletonBaseAssetsResponse;
}
