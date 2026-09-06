// Perfil local del usuario (ticket 036, HU-6) -- SOLO nombre para
// mostrar, sin cuentas, sin login, sin backend (confirmado
// explícitamente por Marco en la fase de definición, ver
// docs/definiciones/proyectos-y-navegacion.md). Persistido en
// `localStorage` vía `globalThis.localStorage` (mismo criterio que
// `theme.ts`/`projectStorage.ts` -- testeable en el entorno de test
// `environment: 'node'` sin jsdom).
//
// La inicial del avatar se DERIVA de `displayName` (ver
// `getAvatarInitial`) -- no es un campo separado que el usuario deba
// llenar aparte, para no pedir dos datos por una sola cosa visual.

export interface UserPrefs {
  displayName: string;
}

const STORAGE_KEY = 'ts-user-prefs';
const DEFAULT_PREFS: UserPrefs = { displayName: 'Usuario' };

function isUserPrefs(value: unknown): value is UserPrefs {
  return typeof value === 'object' && value !== null && typeof (value as { displayName?: unknown }).displayName === 'string';
}

/** Lee las preferencias guardadas, o `DEFAULT_PREFS` si nunca se configuraron (o el valor guardado es inválido/`localStorage` no está disponible). */
export function getUserPrefs(): UserPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    if (raw === null) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    return isUserPrefs(parsed) ? parsed : DEFAULT_PREFS;
  } catch (err) {
    console.warn(`userPrefs: no se pudo leer "${STORAGE_KEY}" de localStorage -- se usan las preferencias por defecto.`, err);
    return DEFAULT_PREFS;
  }
}

/** Guarda las preferencias completas (reemplaza, no mergea -- el llamador ya tiene el objeto completo vía `getUserPrefs`). */
export function setUserPrefs(prefs: UserPrefs): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn(`userPrefs: no se pudo guardar "${STORAGE_KEY}" en localStorage -- el nombre no persistirá al recargar.`, err);
  }
}

/** Primera letra de `displayName` en mayúscula -- "" si el nombre está vacío (ej. mientras el usuario borra el campo antes de escribir uno nuevo). */
export function getAvatarInitial(displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : '';
}
