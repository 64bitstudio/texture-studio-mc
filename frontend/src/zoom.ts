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

/**
 * Zoom minimo: 0.5 pixeles CSS por texel (50%). Bajado desde 4 (400%,
 * el piso original del ticket 004) a pedido de Marco -- en resoluciones
 * de trabajo altas (x4-x10) el buffer completo no cabia en el panel ni
 * al zoom minimo anterior, sin forma de alejar mas para ver el conjunto.
 */
export const ZOOM_MIN = 0.5;

/** Zoom maximo: 40 pixeles CSS por texel (4000%) -- suficiente para precision fina sin backing stores de grid excesivos. */
export const ZOOM_MAX = 40;

/** Incremento por "muesca" de rueda del mouse (Ctrl/Cmd + scroll sobre el canvas, `TextureEditor.tsx`) -- el selector de la barra de herramientas (`ZoomControls.tsx`) ya no usa este paso, ver `ZOOM_PRESETS`. */
export const ZOOM_STEP = 2;

/**
 * Niveles de zoom del `<select>` de la barra de herramientas (pedido de
 * Marco: "faltan las opciones 300, 200, 100 y 50" -- reemplaza los
 * botones +/- por una lista de paradas fijas, mismo patron visual que
 * "Resolución" en la misma barra). Cubre el rango completo
 * [ZOOM_MIN, ZOOM_MAX] con paradas redondas en porcentaje; el zoom
 * continuo (rueda del mouse) sigue funcionando igual, sin depender de
 * esta lista.
 */
export const ZOOM_PRESETS: number[] = [0.5, 1, 2, 3, 4, 6, 8, 10, 20, 30, 40];

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
