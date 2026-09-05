// Constantes y utilidades puras de zoom del editor de textura (ticket
// 004, HU-7: ver docs/definiciones/editor-3d-texturas-esqueleto.md).
//
// `zoom` es el factor de escala de presentacion: cuantos pixeles CSS
// ocupa cada texel del buffer (64x32). Reemplaza al `DISPLAY_SCALE`
// fijo (=10) que usaba `TextureEditor` desde el ticket 002 -- mismo
// mecanismo de escalado (backing store del canvas en resolucion nativa
// del buffer + CSS `width`/`height` mas grande + `image-rendering:
// pixelated`), ahora con el factor como estado variable en vez de una
// constante, para mantener pixel-perfect (sin blur/interpolacion) en
// cualquier nivel de zoom -- ver decision completa en
// docs/ARQUITECTURA.md, "Ticket 004".

/** Zoom minimo: 4 pixeles CSS por texel (400%). */
export const ZOOM_MIN = 4;

/** Zoom maximo: 40 pixeles CSS por texel (4000%) -- suficiente para precision fina sin backing stores de grid excesivos. */
export const ZOOM_MAX = 40;

/** Incremento por click de +/- o por "muesca" de rueda del mouse. */
export const ZOOM_STEP = 2;

/** Zoom inicial al abrir el editor -- igual al `DISPLAY_SCALE` fijo que tenia el ticket 002, para no cambiar la apariencia por default. */
export const ZOOM_DEFAULT = 10;

/** Recorta un valor de zoom propuesto al rango valido [ZOOM_MIN, ZOOM_MAX]. */
export function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

/** Porcentaje de zoom a mostrar en la UI -- 100% == 1 pixel CSS por texel (zoom=1). */
export function zoomToPercent(zoom: number): number {
  return Math.round(zoom * 100);
}
