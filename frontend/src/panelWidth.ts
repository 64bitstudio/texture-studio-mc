// Ancho del panel lateral (`<aside>`) redimensionable (ticket 010).
// Modulo puro -- mismo criterio de testabilidad que
// `zoom.ts`/`resolution.ts` (constantes + una funcion de recorte
// pura). Las funciones de lectura/escritura de `localStorage` tambien
// viven aca (no en el componente) para que `Editor.tsx` no maneje
// try/catch de acceso a storage directamente, pero no se testean con
// Vitest (dependen de `window`, y el entorno de test de este proyecto
// es `environment: 'node'`, ver `vitest.config.ts` -- mismo criterio ya
// aplicado a `decodeTexture.ts`/`export.ts`: lo que depende del DOM se
// separa de la logica pura y se valida con revision visual en vivo).

/** Ancho minimo del panel lateral, en pixeles CSS. */
export const PANEL_WIDTH_MIN = 220;

/**
 * Ancho maximo del panel lateral, en pixeles CSS. Criterio: bastante
 * espacio para que el select de resolucion (`ResolutionControls`, ej.
 * "×10 (640×320)") y cualquier control futuro respiren, sin permitir
 * que el panel se coma la mayor parte de la pantalla y deje al visor
 * 3D sin espacio util -- no hay un requisito numerico del ticket, este
 * es el criterio de este ticket, documentado aca.
 */
export const PANEL_WIDTH_MAX = 640;

/** Ancho por defecto -- identico al valor fijo que tenia el `<aside>` antes de este ticket (sin cambiar la apariencia por default). */
export const PANEL_WIDTH_DEFAULT = 280;

/** Paso de ajuste por pulsacion de flecha del teclado sobre el handle (accesibilidad, ver `PanelResizeHandle.tsx`). */
export const PANEL_WIDTH_KEYBOARD_STEP = 20;

/** Clave de `localStorage` -- namespaced por proyecto para no chocar con otra app servida desde el mismo origen. */
export const PANEL_WIDTH_STORAGE_KEY = 'texture-studio-mc:sidebarWidth';

/** Recorta un ancho de panel propuesto al rango valido [PANEL_WIDTH_MIN, PANEL_WIDTH_MAX]. */
export function clampPanelWidth(value: number): number {
  return Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, value));
}

/**
 * Lee el ancho persistido (conveniencia por navegador, no un dato de
 * usuario que deba sincronizarse -- ver nota del ticket 010). Cualquier
 * fallo (storage deshabilitado/modo privado/valor corrupto) cae al
 * default de forma visible (`console.warn`, nunca silenciosa) -- un
 * ancho de panel invalido no debe impedir que el editor cargue, pero
 * tampoco debe ocultarse por completo si algo raro esta pasando con el
 * storage del navegador.
 */
export function loadStoredPanelWidth(): number {
  try {
    const raw = window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    if (raw === null) return PANEL_WIDTH_DEFAULT;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      console.warn(`panelWidth: valor invalido en localStorage ("${raw}") -- usando el ancho por defecto.`);
      return PANEL_WIDTH_DEFAULT;
    }
    return clampPanelWidth(parsed);
  } catch (err) {
    console.warn('panelWidth: no se pudo leer localStorage -- usando el ancho por defecto.', err);
    return PANEL_WIDTH_DEFAULT;
  }
}

/** Persiste el ancho elegido. Falla de forma visible (misma razon que `loadStoredPanelWidth`) -- es una conveniencia, no un dato critico, pero el fallo no se oculta. */
export function savePanelWidth(width: number): void {
  try {
    window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(width));
  } catch (err) {
    console.warn('panelWidth: no se pudo persistir el ancho del panel en localStorage.', err);
  }
}
