import { computeMobFrontSpriteLayout } from './geometry/mobFrontSprite';
import type { MobGeometry } from './types/baseAssets';

/**
 * Dibuja el layout puro de `computeMobFrontSpriteLayout` sobre un
 * `<canvas>` real y devuelve una `data:` URL lista para usar como `src`
 * de un `<img>` -- separado de `geometry/mobFrontSprite.ts` (puro, sin
 * DOM) por el mismo criterio ya establecido en el proyecto entre
 * `textureBuffer.ts`/`decodeTexture.ts` y `exportPack.ts`/`export.ts`.
 *
 * `resolution` (ticket 009, multiplicador x1/x2/x4/etc. con el que se
 * guardó la textura del proyecto): la textura real decodificada mide
 * `geometry.textureWidth*resolution x geometry.textureHeight*resolution`,
 * pero el layout (`MobFrontSpriteLayout`) siempre está calculado en
 * unidades "x1" (mismas que `MobBoxPart.size`/`position`) -- los rects
 * de origen se escalan por `resolution` aquí, al momento de leer la
 * textura real, en vez de tener que recalcular el layout por
 * resolución. El sprite de SALIDA se queda en tamaño "x1" (chico) --
 * quien lo consuma (`<img>`) lo escala más grande vía CSS, igual que ya
 * hace `mobIcons.ts` con sus miniaturas oficiales.
 */
export function renderMobFrontSprite2D(geometry: MobGeometry, texturePngDataUrl: string, resolution = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const layout = computeMobFrontSpriteLayout(geometry);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = layout.width;
      canvas.height = layout.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo obtener el contexto 2D del canvas del sprite 2D.'));
        return;
      }
      // Pixel-art nitido, mismo criterio que el resto de la app (ver
      // `useCanvasTexture.ts`/`decodeTexture.ts`).
      ctx.imageSmoothingEnabled = false;

      for (const draw of layout.draws) {
        const sx = draw.src.x0 * resolution;
        const sy = draw.src.y0 * resolution;
        const sw = (draw.src.x1 - draw.src.x0) * resolution;
        const sh = (draw.src.y1 - draw.src.y0) * resolution;

        if (draw.flipX) {
          ctx.save();
          // Refleja horizontalmente ALREDEDOR del propio rect de
          // destino (no del canvas completo) -- mismo efecto que
          // `mirrorX` en `applyBoxUV`, sin mover la posición del rect.
          ctx.translate(draw.destX + draw.destWidth, draw.destY);
          ctx.scale(-1, 1);
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, draw.destWidth, draw.destHeight);
          ctx.restore();
        } else {
          ctx.drawImage(img, sx, sy, sw, sh, draw.destX, draw.destY, draw.destWidth, draw.destHeight);
        }
      }

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('No se pudo decodificar la textura para el preview 2D.'));
    img.src = texturePngDataUrl;
  });
}
