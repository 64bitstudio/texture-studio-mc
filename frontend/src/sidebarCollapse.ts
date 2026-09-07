// Preferencia de sidebar colapsado/expandido (pedido de Marco: "haz que
// el sidebar pueda hacerse pequeno"). Persistida en `localStorage` bajo
// `STORAGE_KEY` -- mismo criterio exacto que `theme.ts` (que ya
// resuelve este mismo problema para la preferencia de tema): un módulo
// dedicado por preferencia, en vez de sumarla a `userPrefs.ts` (que es
// específicamente el perfil local del usuario -- `displayName`, ticket
// 036 -- no un cajón genérico de configuración de UI).
//
// `globalThis.localStorage` (no `window.localStorage`) -- testeable en
// el entorno de test `environment: 'node'` (sin `window`) mockeando
// `globalThis.localStorage`, mismo motivo documentado en `theme.ts`.

const STORAGE_KEY = 'ts-sidebar-collapsed';
const DEFAULT_COLLAPSED = false;

/** Lee la preferencia guardada, o `DEFAULT_COLLAPSED` (expandido) si nunca se configuró (o `localStorage` no está disponible). */
export function getSidebarCollapsed(): boolean {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return DEFAULT_COLLAPSED;
  } catch (err) {
    console.warn(`sidebarCollapse: no se pudo leer "${STORAGE_KEY}" de localStorage -- se usa el valor por defecto (expandido).`, err);
    return DEFAULT_COLLAPSED;
  }
}

/** Guarda la preferencia. */
export function setSidebarCollapsed(collapsed: boolean): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, String(collapsed));
  } catch (err) {
    // localStorage puede no estar disponible (ej. navegación privada
    // estricta) -- el estado igual se aplica para esta sesión (el
    // llamador ya actualizó su propio `useState`), solo no persiste
    // entre recargas. Se loguea, no se oculta (regla 8 de CLAUDE.md).
    console.warn(`sidebarCollapse: no se pudo guardar "${STORAGE_KEY}" en localStorage -- la preferencia no persistirá al recargar.`, err);
  }
}
