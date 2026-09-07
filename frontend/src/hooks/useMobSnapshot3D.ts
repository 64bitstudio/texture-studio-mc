import { useEffect, useState } from 'react';
import { renderMobSnapshot3D } from '../renderMobSnapshot3D';
import type { MobGeometry } from '../types/baseAssets';

/**
 * Hook delgado sobre `renderMobSnapshot3D` (ticket 062, reemplaza a
 * `useMobFrontSprite2D` del ticket 055) -- recalcula la miniatura solo
 * cuando cambia la textura/geometría recibidas, y devuelve `null`
 * mientras no hay suficiente información (geometría todavía sin
 * cargar) o mientras el render está en curso, sin dejar un `<img>` roto
 * a mitad de camino. Mismo criterio exacto que su predecesor -- ver ese
 * hook (retirado) para el porqué de cada detalle.
 *
 * Sin parámetro `resolution`: a diferencia del compositor 2D anterior
 * (que escalaba el canvas de salida a la resolución real de la
 * textura), el motor 3D renderiza siempre al mismo `outputSize` fijo
 * (ver `renderMobSnapshot3D.ts`) -- la resolución de la textura de
 * origen ya viene implícita en `pngDataUrl` (sus píxeles reales), no
 * hace falta pasarla aparte.
 */
export function useMobSnapshot3D(geometry: MobGeometry | null, pngDataUrl: string | null): string | null {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!geometry || !pngDataUrl) return;

    let cancelled = false;
    renderMobSnapshot3D(geometry, pngDataUrl)
      .then((url) => {
        if (!cancelled) setSnapshotUrl(url);
      })
      .catch((err: unknown) => {
        console.warn(`useMobSnapshot3D: no se pudo generar la miniatura 3D.`, err);
        if (!cancelled) setSnapshotUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [geometry, pngDataUrl]);

  if (!geometry || !pngDataUrl) return null;
  return snapshotUrl;
}
