import { useEffect, useState } from 'react';
import { renderMobFrontSprite2D } from '../renderMobFrontSprite2D';
import type { MobGeometry } from '../types/baseAssets';

/**
 * Hook delgado sobre `renderMobFrontSprite2D` (ticket 055) -- recalcula
 * el sprite 2D solo cuando cambia la textura/geometría/resolución
 * recibidas, y devuelve `null` mientras no hay suficiente información
 * (geometría todavía sin cargar) o mientras el render está en curso, sin
 * dejar un `<img>` roto a mitad de camino.
 *
 * `pngDataUrl`/`geometry` pueden llegar como `null` (ej. la geometría
 * del mob todavía no terminó de cargar vía `fetchMobBaseAssets`) --
 * quien use este hook decide qué mostrar mientras tanto (spinner,
 * miniatura anterior, etc.), este hook solo expone el resultado o
 * `null`.
 */
export function useMobFrontSprite2D(geometry: MobGeometry | null, pngDataUrl: string | null, resolution = 1): string | null {
  const [spriteUrl, setSpriteUrl] = useState<string | null>(null);

  useEffect(() => {
    // Si falta info todavia no hay nada que sincronizar con el sistema
    // externo (canvas/Image) -- el `return` de abajo ya deriva `null`
    // directamente en ese caso, sin pasar por `setState` (oxlint
    // `react/set-state-in-effect`: evitar el render en cascada
    // innecesario, mismo criterio ya aplicado en `App.tsx`/
    // `useCanvasTexture.ts`).
    if (!geometry || !pngDataUrl) return;

    let cancelled = false;
    renderMobFrontSprite2D(geometry, pngDataUrl, resolution)
      .then((url) => {
        if (!cancelled) setSpriteUrl(url);
      })
      .catch((err: unknown) => {
        // `null` es una señal valida de "no hay preview 2D todavia"
        // para quien consume este hook (mismo criterio que "geometria
        // sin cargar") -- pero el error real SIEMPRE se loguea (nunca
        // silencioso del todo, mismo criterio que `readAllProjects` en
        // `projectStorage.ts`), para poder diagnosticar un fallo real
        // de decodificacion/dibujado sin que la tarjeta se rompa.
        console.warn(`useMobFrontSprite2D: no se pudo generar el preview 2D.`, err);
        if (!cancelled) setSpriteUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [geometry, pngDataUrl, resolution]);

  if (!geometry || !pngDataUrl) return null;
  return spriteUrl;
}
