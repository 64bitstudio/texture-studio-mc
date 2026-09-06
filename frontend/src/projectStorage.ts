// Guardado de proyectos por nombre en localStorage (ticket 019, HU-3/
// HU-4/HU-5 -- ver docs/definiciones/multi-mob-y-proyectos-guardados.md,
// "Diseño técnico" / "Formato de almacenamiento"). Modulo PURO -- sin
// React/DOM/canvas/three.js, mismo criterio de testabilidad que
// `textureBuffer.ts`/`history.ts`/`symmetry.ts`/`resolution.ts` (ver
// `frontend/test/projectStorage.spec.ts`): la codificacion/decodificacion
// de PNG (que si necesita DOM -- `encodeBufferToPngBlob`/
// `decodePngDataUrlToImageData`) vive fuera de este archivo, en
// `projectSnapshot.ts` -- este modulo solo sabe leer/escribir el objeto
// JSON de `localStorage`, nunca toca un `TextureBuffer` ni un canvas.
//
// DECISION -- `globalThis.localStorage` en vez de `window.localStorage`:
// `panelWidth.ts` (ticket 010, panel lateral redimensionable --
// eliminado en el ticket 029 al reemplazar ese layout por el panel en
// grid de ancho flexible, ver docs/ARQUITECTURA.md "Ticket 029") ya
// persistia en localStorage pero via `window.localStorage`, y
// deliberadamente NO tenia tests unitarios de esas funciones (el
// entorno de test de este proyecto es `environment: 'node'`, sin
// `window`, ver `vitest.config.ts`). Este ticket SI exige tests unitarios
// de guardar/cargar/listar/eliminar con un mock de `localStorage` (ver
// ticket, seccion "Verificacion") -- referenciar `window` a secas en
// Node lanzaria `ReferenceError: window is not defined` incluso antes
// de intentar mockear nada. `globalThis.localStorage` es identico a
// `window.localStorage` en cualquier navegador real (`window ===
// globalThis` ahi) pero permite que los tests simplemente hagan
// `globalThis.localStorage = mockStorage` antes de importar/llamar estas
// funciones, sin necesitar jsdom ni cambiar el `environment` del
// proyecto completo solo por este modulo.

/** Entrada de un mob dentro de un proyecto guardado -- PNG comprimido (base64) + resolucion de trabajo con la que se guardo. */
export interface ProjectMobEntry {
  resolution: number;
  pngDataUrl: string;
}

/** Un proyecto guardado completo -- uno o mas mobs, ver HU-3 ("varios mobs a la vez"). */
export interface ProjectRecord {
  updatedAt: string;
  mobs: Record<string, ProjectMobEntry>;
}

/**
 * Fila minima para listar proyectos guardados (HU-4: "nombres y fecha de
 * guardado"). `mobIds` (ticket 027, ensanchamiento aditivo -- ver
 * `docs/ARQUITECTURA.md`, "Ticket 027"): las claves de `mobs` de ese
 * proyecto YA estan disponibles en el registro crudo sin decodificar
 * ningun PNG (`Object.keys(record.mobs)`, ver `listProjects`) -- se
 * exponen aca para que la pantalla de inicio (`HomeScreen.tsx`) muestre
 * que mobs contiene cada proyecto, y para que el filtro por mob del
 * ticket 028 (HU-2) pueda filtrar sin cargar/decodificar cada proyecto.
 */
export interface ProjectSummary {
  name: string;
  updatedAt: string;
  mobIds: string[];
}

/** Clave de `localStorage` -- exactamente la que fija el documento de definicion, namespaced por proyecto (mismo criterio que `PANEL_WIDTH_STORAGE_KEY`). */
export const PROJECTS_STORAGE_KEY = 'texture-studio-mc:projects';

/**
 * Se lanza al intentar `saveProject` sobre un nombre que ya existe sin
 * pasar `{ overwrite: true }` -- HU-3, criterio de aceptacion explicito
 * ("nunca se sobrescribe en silencio"). DECISION de este ticket: la
 * regla de "pedir confirmacion antes de sobrescribir" se hace cumplir
 * en el modulo de datos (lanzando este error tipado), no solo como una
 * convencion que la UI deba recordar respetar -- asi queda garantizado
 * (y testeado) que nunca hay un sobrescrito accidental sin im pasar
 * `overwrite: true` explicitamente, sin importar que UI lo consuma.
 */
export class ProjectAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Ya existe un proyecto guardado con el nombre "${name}".`);
    this.name = 'ProjectAlreadyExistsError';
  }
}

function getStorage(): Storage {
  const storage = globalThis.localStorage;
  if (!storage) {
    throw new Error('localStorage no esta disponible en este navegador/entorno.');
  }
  return storage;
}

/**
 * Lee y parsea el objeto completo de proyectos. Un valor ausente es el
 * caso normal (primera vez que se usa la app) -- `{}`. Un valor presente
 * pero corrupto (JSON invalido, o no es un objeto) NUNCA lanza ni deja
 * la app inutilizable -- se trata como "sin proyectos guardados"
 * (`console.warn`, nunca silencioso del todo) en vez de propagar un
 * error que bloquee `listProjects`/`loadProject` para siempre.
 */
function readAllProjects(): Record<string, ProjectRecord> {
  const raw = getStorage().getItem(PROJECTS_STORAGE_KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn(`projectStorage: valor invalido en "${PROJECTS_STORAGE_KEY}" -- se ignora, se trata como sin proyectos guardados.`);
      return {};
    }
    return parsed as Record<string, ProjectRecord>;
  } catch (err) {
    console.warn(`projectStorage: no se pudo parsear "${PROJECTS_STORAGE_KEY}" -- se trata como sin proyectos guardados.`, err);
    return {};
  }
}

/**
 * Escribe el objeto completo de proyectos. Deliberadamente NO atrapa
 * ninguna excepcion (ej. `QuotaExceededError`) -- se propaga tal cual al
 * llamador (ticket, criterio explicito: "mostrar un mensaje claro...
 * nunca fallar en silencio"). Atraparla aca y solo loguearla seria
 * exactamente el "parche silencioso" que las reglas del equipo prohiben:
 * quien llama a `saveProject`/`deleteProject` necesita ENTERARSE de que
 * la escritura fallo para poder avisarle al usuario.
 */
function writeAllProjects(projects: Record<string, ProjectRecord>): void {
  getStorage().setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

/** Indica si ya existe un proyecto guardado con ese nombre exacto -- para que la UI decida si debe confirmar antes de llamar a `saveProject` con `overwrite: true`. */
export function projectExists(name: string): boolean {
  return name in readAllProjects();
}

/**
 * Lista los proyectos guardados (HU-4: "nombres y fecha de guardado").
 * DECISION de este ticket (no especificada por el ticket ni la
 * definicion): orden por `updatedAt` DESCENDENTE (el mas reciente
 * primero) -- mismo criterio que cualquier lista de "archivos
 * recientes"/"partidas guardadas" ya familiar para el usuario, sin
 * necesidad de que ordene manualmente para encontrar en lo que trabajo
 * por ultima vez.
 */
export function listProjects(): ProjectSummary[] {
  const all = readAllProjects();
  return Object.entries(all)
    .map(([name, record]) => ({ name, updatedAt: record.updatedAt, mobIds: Object.keys(record.mobs) }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Guarda (o sobrescribe) un proyecto. `mobs` ya viene con el PNG
 * codificado a base64 por mob (ver `projectSnapshot.ts` -- este modulo
 * puro no sabe como se produjo ese PNG, solo lo persiste tal cual).
 *
 * - Nombre vacio/solo espacios: rechazado (`RangeError`) -- un proyecto
 *   sin nombre no se podria distinguir en la lista de HU-4.
 * - Nombre ya existente sin `overwrite: true`: lanza
 *   `ProjectAlreadyExistsError` (ver su doc) -- la UI debe confirmar con
 *   el usuario y volver a llamar con `overwrite: true` si confirma.
 * - Cualquier fallo de `localStorage.setItem` (ej. `QuotaExceededError`)
 *   se propaga sin atrapar -- ver `writeAllProjects`.
 */
export function saveProject(name: string, mobs: Record<string, ProjectMobEntry>, options: { overwrite?: boolean } = {}): void {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new RangeError('El nombre del proyecto no puede estar vacio.');
  }
  if (Object.keys(mobs).length === 0) {
    throw new RangeError('No hay ningun mob con contenido en memoria para guardar.');
  }

  const all = readAllProjects();
  if (trimmed in all && !options.overwrite) {
    throw new ProjectAlreadyExistsError(trimmed);
  }

  all[trimmed] = { updatedAt: new Date().toISOString(), mobs };
  writeAllProjects(all);
}

/** Carga un proyecto guardado por nombre exacto. `null` si no existe (HU-4/HU-5: nombre ya eliminado, o nunca existio). */
export function loadProject(name: string): ProjectRecord | null {
  const all = readAllProjects();
  return all[name] ?? null;
}

/**
 * Elimina un proyecto guardado (HU-5). No-op seguro si el nombre no
 * existe (eliminar algo que ya no esta no es un error -- ej. dos
 * pestañas del mismo navegador eliminando el mismo proyecto).
 */
export function deleteProject(name: string): void {
  const all = readAllProjects();
  if (!(name in all)) return;
  delete all[name];
  writeAllProjects(all);
}

/**
 * Borra TODOS los proyectos guardados de una vez (ticket 036, pantalla
 * "Configuración", "Borrar todos los datos locales"). Elimina solo la
 * clave `PROJECTS_STORAGE_KEY` -- NO toca ninguna otra clave de
 * `localStorage` que use esta app (tema, preferencias de usuario), ya
 * que esas son preferencias de UI, no "datos" en el sentido de trabajo
 * guardado (el criterio de aceptación del ticket solo pide que
 * `listProjects()` quede vacío). La UI que llame a esto es responsable
 * de pedir confirmación en línea antes -- esta función nunca confirma
 * por su cuenta.
 */
export function deleteAllProjects(): void {
  getStorage().removeItem(PROJECTS_STORAGE_KEY);
}
