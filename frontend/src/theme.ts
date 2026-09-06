// Preferencia de tema claro/oscuro (ticket 034, HU-5). Persistida en
// `localStorage` bajo `STORAGE_KEY` -- el script inline de `index.html`
// lee la MISMA clave (duplicado a propósito, en JS plano sin imports,
// para poder correr ANTES del primer render de React y evitar el
// parpadeo del tema por defecto) y aplica el atributo `data-theme` en
// `<html>` antes de que llegue ningún CSS de este módulo. Este archivo
// es la fuente de verdad después del arranque -- el toggle rápido del
// header (ticket 037) y el selector de "Configuración" (ticket 036)
// leen/escriben la MISMA preferencia via `getTheme`/`setTheme`, sin
// duplicar el estado en dos lugares.
//
// `globalThis.localStorage` (no `window.localStorage`) -- mismo criterio
// ya establecido en `projectStorage.ts` (ticket 019): permite testear
// `getTheme`/`nextTheme` en el entorno de test `environment: 'node'`
// (sin `window`) mockeando `globalThis.localStorage`, sin necesitar
// jsdom para todo el proyecto. `setTheme`/`toggleTheme` SÍ tocan el DOM
// (`document.documentElement`) -- esos, como el resto de código que
// toca canvas/DOM en este proyecto, se verifican en vivo (Claude in
// Chrome), no con un test unitario (ver `vitest.config.ts`).

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ts-theme';
const DEFAULT_THEME: Theme = 'dark';

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Lee la preferencia guardada, o `DEFAULT_THEME` si nunca se configuró (o `localStorage` no está disponible). */
export function getTheme(): Theme {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch (err) {
    console.warn(`theme: no se pudo leer "${STORAGE_KEY}" de localStorage -- se usa el tema por defecto.`, err);
    return DEFAULT_THEME;
  }
}

/** Puro -- el tema al que se cambiaría desde `current`. Extraído aparte para poder testear la lógica de alternancia sin tocar `localStorage`/DOM. */
export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

/** Guarda la preferencia y aplica el atributo `data-theme` en `<html>` de inmediato. */
export function setTheme(theme: Theme): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, theme);
  } catch (err) {
    // localStorage puede no estar disponible (ej. navegación privada
    // estricta) -- el tema igual se aplica para esta sesión (ver abajo),
    // solo no persiste entre recargas. Se loguea, no se oculta.
    console.warn(`theme: no se pudo guardar "${STORAGE_KEY}" en localStorage -- el tema no persistirá al recargar.`, err);
  }
  globalThis.document.documentElement.dataset.theme = theme;
}

/** Alterna entre 'dark'/'light', guarda y aplica -- devuelve el tema resultante. */
export function toggleTheme(): Theme {
  const next = nextTheme(getTheme());
  setTheme(next);
  return next;
}
