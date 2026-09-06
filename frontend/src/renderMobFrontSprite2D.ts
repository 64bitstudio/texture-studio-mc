import { computeMobFrontSpriteLayout } from './geometry/mobFrontSprite';
import type { MobGeometry } from './types/baseAssets';

/**
 * Dibuja el layout puro de `computeMobFrontSpriteLayout` sobre un
 * `<canvas>` real y devuelve una `data:` URL lista para usar como `src`
 * de un `<img>` -- separado de `geometry/mobFrontSprite.ts` (puro, sin
 * DOM) por el mismo criterio ya establecido en el proyecto entre
 * `textureBuffer.ts`/`decodeTexture.ts` y `exportPack.ts`/`export.ts`.
 *
 * `resolution` (ticket 009, multiplicador x1/x2/x4/x6/etc. con el que
 * se guardó la textura del proyecto): la textura real decodificada mide
 * `geometry.textureWidth*resolution x geometry.textureHeight*resolution`.
 *
 * **Ticket 058 (hallazgo real, bug de Marco con una textura x6):** la
 * primera versión de esta función armaba el canvas de salida en tamaño
 * "x1" (chico, `layout.width/height` tal cual) y usaba `ctx.drawImage`
 * para ENCOGER cada región de origen (ya a resolución real) hasta ese
 * tamaño chico. Con `imageSmoothingEnabled = false`, encoger una imagen
 * hace que el navegador muestree vecino-más-cercano: cada píxel de
 * destino "elige" un solo píxel de un bloque de `resolution × resolution`
 * píxeles de origen, sin promediar -- para una textura detallada (no un
 * bloque de color plano, que es lo único que tenían los proyectos de
 * prueba del ticket 055) esto produce ruido visible de colores
 * mezclados, no la textura real. Fix: el canvas de salida se arma a la
 * resolución REAL (`layout.width*resolution x layout.height*resolution`)
 * y cada `drawImage` copia 1:1 (mismo tamaño de origen y destino, sin
 * escalar nada dentro del canvas) -- el sprite resultante conserva todo
 * el detalle real de la textura; quien lo muestre más chico (miniatura
 * de tarjeta) o más grande (modal ampliado) deja que el navegador
 * escale la imagen YA completa a través de CSS, en vez de que el propio
 * compositor tire información antes de tiempo.
 */
export function renderMobFrontSprite2D(geometry: MobGeometry, texturePngDataUrl: string, resolution = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const layout = computeMobFrontSpriteLayout(geometry);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = layout.width * resolution;
      canvas.height = layout.height * resolution;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo obtener el contexto 2D del canvas del sprite 2D.'));
        return;
      }
      // Sin efecto real una vez que origen y destino miden lo mismo
      // (ver comentario de arriba) -- se deja en `false` de todos modos
      // por si algún `draw` puntual llegara a necesitar escalar.
      ctx.imageSmoothingEnabled = false;

      for (const draw of layout.draws) {
        const sx = draw.src.x0 * resolution;
        const sy = draw.src.y0 * resolution;
        const sw = (draw.src.x1 - draw.src.x0) * resolution;
        const sh = (draw.src.y1 - draw.src.y0) * resolution;
        const destX = draw.destX * resolution;
        const destY = draw.destY * resolution;
        const destWidth = draw.destWidth * resolution;
        const destHeight = draw.destHeight * resolution;

        if (draw.flipX) {
          ctx.save();
          // Refleja horizontalmente ALREDEDOR del propio rect de
          // destino (no del canvas completo) -- mismo efecto que
          // `mirrorX` en `applyBoxUV`, sin mover la posición del rect.
          ctx.translate(destX + destWidth, destY);
          ctx.scale(-1, 1);
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, destWidth, destHeight);
          ctx.restore();
        } else {
          ctx.drawImage(img, sx, sy, sw, sh, destX, destY, destWidth, destHeight);
        }
      }

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('No se pudo decodificar la textura para el preview 2D.'));
    img.src = texturePngDataUrl;
  });
}
