import { computeBoxFaceRects, type PixelRect } from './applyBoxUV';
import type { MobBoxPart, MobGeometry } from '../types/baseAssets';

/**
 * Motor de preview 2D "de frente" de un mob (ticket 055, ver
 * `docs/definiciones/preview-2d-y-rediseno-proyecto.md`) -- reemplaza el
 * render 3D en vivo que usaban las tarjetas de mob de "Proyecto" (ese
 * componente sigue existiendo tal cual para el EDITOR real, ver
 * `Viewer3D.tsx`; esto es solo para miniaturas/preview).
 *
 * Deliberadamente PURO -- ni React ni DOM/canvas (mismo criterio de
 * testabilidad que `applyBoxUV.ts`/`symmetry.ts`): solo calcula QUÉ
 * rectángulo de la textura va a QUÉ posición del sprite 2D final, en el
 * mismo sistema de unidades que `MobBoxPart.position`/`size` (1 unidad =
 * 1 pixel de textura a resolución x1, ver `classicBipedGeometry.ts`
 * backend). Quien realmente dibuja los pixeles sobre un `<canvas>` es
 * `renderMobFrontSprite2D.ts` (aparte, sí toca DOM) -- mismo patrón de
 * separación ya usado por `textureBuffer.ts` (puro) vs `decodeTexture.ts`
 * (DOM).
 *
 * ESTRATEGIA (ver documento de definición, "Diseño técnico"):
 * - Por cada parte, se toma el rect `front` de `computeBoxFaceRects`
 *   (mismo cálculo ya usado y verificado por `applyBoxUV`/el visor 3D --
 *   no se duplica la fórmula del "cross" UV).
 * - `mirrorX` SÍ afecta la cara `front` (confirmado leyendo
 *   `applyBoxUV`: el mapeo UV de TODAS las caras, front incluida, se
 *   invierte horizontalmente cuando `mirrorX` es true -- no solo
 *   left/right) -- se traduce a `flipX` en el comando de dibujado, para
 *   que quien dibuje espeje la imagen recortada antes de pegarla.
 * - La posición 2D de cada parte se proyecta ortográficamente
 *   ignorando profundidad: `x = position[0]` (mismo eje que ya usa el
 *   visor 3D, "+x = derecha de pantalla" -- sin necesidad de invertir
 *   izquierda/derecha, la convención ya es "de frente"), `y = -position[1]`
 *   (Minecraft: Y crece hacia arriba; canvas: Y crece hacia abajo).
 * - El orden de dibujado es por `position[2]` ascendente (de más lejos a
 *   más cerca de la cámara, "+z = hacia la cámara/frente del personaje"
 *   segun `classicBipedGeometry.ts`) -- una parte más cercana pinta
 *   ENCIMA de una más lejana, igual que ocluiría en 3D.
 *
 * LIMITACIÓN CONOCIDA Y ACEPTADA (ver documento de definición, "Riesgos
 * y preguntas abiertas"): partes con `pivot`/`rotation` (hoy solo las
 * patas de la Araña, ticket 024) se dibujan en su posición de reposo
 * (`position` tal cual), SIN aplicar la rotación en 2D -- una rotación 2D
 * correcta alrededor del pivote proyectado es una mejora incremental de
 * este mismo motor, no una razón para bloquear esta primera versión.
 */

/** Un comando de dibujado: de qué rect de la textura (en px de textura a resolución x1) a qué rect del sprite 2D final (en px del sprite, también a "escala x1" -- quien dibuje decide cómo mostrarlo más grande). */
export interface MobFrontSpriteDraw {
  /** Rect de origen en la textura, en píxeles a resolución x1 (multiplicar por la resolución real de trabajo al leer la textura guardada -- ver `renderMobFrontSprite2D.ts`). */
  src: PixelRect;
  /** `true` si el rect de origen debe dibujarse reflejado horizontalmente (mismo criterio que `mirrorX` en `applyBoxUV`). */
  flipX: boolean;
  destX: number;
  destY: number;
  destWidth: number;
  destHeight: number;
}

export interface MobFrontSpriteLayout {
  /** Ancho/alto del sprite 2D completo, en píxeles a "escala x1" (mismas unidades que `MobBoxPart.size`). */
  width: number;
  height: number;
  /** Ya ordenados de más lejos a más cerca de la cámara -- dibujar en este orden tal cual. */
  draws: MobFrontSpriteDraw[];
}

/** Margen alrededor de la silueta completa, en píxeles a escala x1 -- evita que el trazo quede pegado al borde del sprite. */
const SPRITE_PADDING = 1;

interface ProjectedPart {
  part: MobBoxPart;
  /** Borde izquierdo proyectado (mundo, sin trasladar todavía al origen del sprite). */
  worldLeft: number;
  /** Borde superior proyectado, ya con el eje Y invertido (pantalla: crece hacia abajo). */
  screenTop: number;
}

/**
 * Calcula el layout 2D completo de un mob a partir de su geometría --
 * NO necesita la textura en sí (eso lo decide `renderMobFrontSprite2D.ts`
 * al momento de dibujar), solo la forma/proporciones, que son fijas por
 * tipo de mob.
 */
export function computeMobFrontSpriteLayout(geometry: MobGeometry): MobFrontSpriteLayout {
  const parts = Object.values(geometry.parts);

  let minWorldX = Infinity;
  let maxWorldX = -Infinity;
  let minScreenTop = Infinity;
  let maxScreenBottom = -Infinity;

  const projected: ProjectedPart[] = parts.map((part) => {
    const [w, h] = part.size;
    const [px, py] = part.position;
    const worldLeft = px - w / 2;
    const worldRight = px + w / 2;
    const screenTop = -py - h / 2;
    const screenBottom = -py + h / 2;

    minWorldX = Math.min(minWorldX, worldLeft);
    maxWorldX = Math.max(maxWorldX, worldRight);
    minScreenTop = Math.min(minScreenTop, screenTop);
    maxScreenBottom = Math.max(maxScreenBottom, screenBottom);

    return { part, worldLeft, screenTop };
  });

  const width = Math.ceil(maxWorldX - minWorldX) + SPRITE_PADDING * 2;
  const height = Math.ceil(maxScreenBottom - minScreenTop) + SPRITE_PADDING * 2;

  // Orden de pintado: de más lejos (menor z) a más cerca (mayor z) de la cámara.
  const ordered = [...projected].sort((a, b) => a.part.position[2] - b.part.position[2]);

  const draws: MobFrontSpriteDraw[] = ordered.map(({ part, worldLeft, screenTop }) => {
    const [w, h, d] = part.size;
    const front = computeBoxFaceRects(part.uv.x, part.uv.y, w, h, d).front;

    return {
      src: front,
      flipX: part.mirrorX ?? false,
      destX: worldLeft - minWorldX + SPRITE_PADDING,
      destY: screenTop - minScreenTop + SPRITE_PADDING,
      destWidth: w,
      destHeight: h,
    };
  });

  return { width, height, draws };
}
