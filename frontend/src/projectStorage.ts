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

import type { MobGeometry } from './types/baseAssets';

/**
 * Estado de la geometria de un mob dentro de un proyecto (ticket 082,
 * Etapas 1-2 de docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md):
 * - `'vanilla'`: usa la geometria fija del catalogo (`MOB_REGISTRY`), sin
 *   personalizar -- comportamiento de siempre, sin cambios.
 * - `'modelando'`: el usuario esta editando su geometria custom en el
 *   editor de modelo (Etapa 1), todavia no confirmada.
 * - `'confirmado'`: la geometria custom quedo fija (Etapa 2, atlas UV ya
 *   generado) -- a partir de aqui el editor de modelo para este mob se
 *   bloquea (ticket 086).
 */
export type GeometryStatus = 'vanilla' | 'modelando' | 'confirmado';

/**
 * Un keyframe de un hueso en un momento dado (segundos), ver "Diseño
 * técnico" del documento de definicion. `rotation` es requerida (todo
 * keyframe define una pose de rotación -- mismo formato ya validado en
 * el spike del ticket 081); `position`/`scale` (ticket 090, HU-10:
 * "keyframes de posición/rotación/escala") son ADITIVOS y opcionales --
 * un keyframe que no las trae simplemente no anima esos canales para
 * ese hueso (el interpolador, ver `animation/interpolation.ts`, solo
 * interpola un canal si AMBOS keyframes vecinos lo traen).
 */
export interface AnimationKeyframe {
  time: number;
  rotation: { x: number; y: number; z: number };
  position?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
}

/**
 * Una animacion nombrada de un mob (Etapa 4). `bones` mapea el nombre de
 * cada caja/hueso (mismas claves que `MobGeometry.parts`) a su lista de
 * keyframes -- un hueso ausente del mapa simplemente no se anima. Mismo
 * formato ya validado en el spike del ticket 081 (ver
 * `done/081-assets/generate_and_validate.py`), tanto para presets
 * parametricos como para propuestas de IA o edicion manual del timeline.
 */
export interface MobAnimation {
  name: string;
  loop: boolean;
  length: number;
  bones: Record<string, AnimationKeyframe[]>;
}

/**
 * Entrada de un mob dentro de un proyecto guardado -- PNG comprimido
 * (base64) + resolucion de trabajo con la que se guardo.
 *
 * `geometryStatus`/`customGeometry`/`animations` (ticket 082): ADITIVOS y
 * opcionales, mismo criterio ya establecido en este archivo para
 * `description`/`coverImageDataUrl` (ver `ProjectRecord`) -- un proyecto
 * guardado ANTES de este ticket simplemente no los tiene, y se trata
 * como un mob `'vanilla'` sin geometria custom ni animaciones, no como un
 * dato faltante que haya que migrar. Usar `getMobGeometryStatus` en vez
 * de leer `geometryStatus` directamente para no repetir ese `?? 'vanilla'`
 * en cada consumidor.
 */
export interface ProjectMobEntry {
  resolution: number;
  pngDataUrl: string;
  geometryStatus?: GeometryStatus;
  /** Solo tiene sentido cuando `geometryStatus !== 'vanilla'` -- la geometria custom de este mob, con jerarquia (`parentId` por caja, ver `MobBoxPart`). */
  customGeometry?: MobGeometry;
  animations?: MobAnimation[];
}

/** Estado real de la geometria de un mob -- ausente en el registro ('vanilla') sin que cada consumidor repita el default. Ver `ProjectMobEntry`. */
export function getMobGeometryStatus(entry: ProjectMobEntry): GeometryStatus {
  return entry.geometryStatus ?? 'vanilla';
}

/** Un proyecto guardado completo -- uno o mas mobs, ver HU-3 ("varios mobs a la vez"). */
export interface ProjectRecord {
  updatedAt: string;
  mobs: Record<string, ProjectMobEntry>;
  /**
   * Descripción libre del proyecto (ticket 056, rediseño de "Proyecto" --
   * ver `docs/definiciones/preview-2d-y-rediseno-proyecto.md`). Opcional
   * y ADITIVO: los proyectos guardados antes de este ticket simplemente
   * no la tienen (`undefined`), se tratan como "sin descripción" en vez
   * de requerir una migración.
   */
  description?: string;
  /**
   * Portada del proyecto (ticket 056), subida por el usuario -- mismo
   * mecanismo `FileReader`/`data:` URL ya usado en el resto de la app
   * (ej. `pngDataUrl` de cada mob). Opcional y ADITIVO, mismo criterio
   * que `description`.
   */
  coverImageDataUrl?: string;
}

/**
 * Fila minima para listar proyectos guardados (HU-4: "nombres y fecha de
 * guardado"). `mobIds` (ticket 027, ensanchamiento aditivo -- ver
 * `docs/ARQUITECTURA.md`, "Ticket 027"): las claves de `mobs` de ese
 * proyecto YA estan disponibles en el registro crudo sin decodificar
 * ningun PNG (`Object.keys(record.mobs)`, ver `listProjects`) -- se
 * exponen aca para que "Mis proyectos" (`MisProyectos.tsx`, ticket 039
 * -- reemplaza a `HomeScreen.tsx`, ticket 027) muestre que mobs
 * contiene cada proyecto, y para que el filtro por mob del ticket 028
 * (HU-2) pueda filtrar sin cargar/decodificar cada proyecto.
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
 *
 * Ticket 072 (hallazgo real, encontrado revisando este archivo antes de
 * agregar "Guardar" al editor -- bug preexistente desde el ticket 042,
 * nunca antes ejercitado en vivo con un proyecto que ya tuviera
 * `description`/`coverImageDataUrl`, ver docs/ARQUITECTURA.md, "Ticket
 * 072"): al sobrescribir un proyecto EXISTENTE (`overwrite: true`,
 * unico caso real -- `AgregarMobModal.tsx` y el nuevo "Guardar" del
 * editor), esta funcion armaba el registro nuevo con SOLO `updatedAt` +
 * `mobs`, descartando en silencio `description`/`coverImageDataUrl` si
 * el proyecto ya los tenia. Fix: preservar esos 2 campos del registro
 * existente (si lo hay) -- esta funcion sigue sin saber nada de
 * "editar descripcion/portada" (eso vive en `updateProjectDescription`/
 * `updateProjectCover`), solo ya no los borra como efecto secundario de
 * guardar mobs.
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
  const existing = all[trimmed];
  if (existing && !options.overwrite) {
    throw new ProjectAlreadyExistsError(trimmed);
  }

  all[trimmed] = {
    updatedAt: new Date().toISOString(),
    mobs,
    description: existing?.description,
    coverImageDataUrl: existing?.coverImageDataUrl,
  };
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
 * Renombra un proyecto guardado (ticket 041, vista de detalle de
 * "Proyecto"). El nombre ES la clave de identidad del registro (mismo
 * criterio que el resto de este módulo) -- renombrar es mover la
 * entrada de una clave a otra, sin tocar su contenido (`mobs`) ni su
 * `updatedAt` (renombrar es un cambio de metadato, no de trabajo hecho
 * sobre el proyecto -- no debería alterar su posición en "Recientes",
 * ticket 040).
 *
 * Si `newName` ya existe, se lanza `ProjectAlreadyExistsError` (mismo
 * tipo que ya usa `saveProject`) -- deliberadamente NO se ofrece
 * "sobrescribir" aquí como sí hace guardar: fusionar o reemplazar dos
 * proyectos con mobs potencialmente distintos bajo un mismo nombre es
 * una operación ambigua que este ticket no define, así que se rechaza
 * con un error claro en vez de inventar una semántica de fusión.
 */
export function renameProject(oldName: string, newName: string): void {
  const all = readAllProjects();
  if (!(oldName in all)) {
    throw new Error(`El proyecto "${oldName}" ya no existe -- puede que se haya eliminado en otra pestaña.`);
  }
  if (newName in all) {
    throw new ProjectAlreadyExistsError(newName);
  }
  const record = all[oldName]!;
  delete all[oldName];
  all[newName] = record;
  writeAllProjects(all);
}

/**
 * Actualiza la descripción de un proyecto guardado (ticket 056). Mismo
 * criterio que `renameProject`: lee/escribe el registro completo, sin
 * tocar `updatedAt` -- la descripción es metadato, no trabajo hecho
 * sobre el proyecto (mismo razonamiento ya aplicado a renombrar).
 * `description` vacío/solo-espacios se guarda como `undefined` (sin
 * descripción), no como cadena vacía -- evita distinguir dos formas de
 * "no hay descripción" en el resto de la app.
 */
export function updateProjectDescription(name: string, description: string): void {
  const all = readAllProjects();
  if (!(name in all)) {
    throw new Error(`El proyecto "${name}" ya no existe -- puede que se haya eliminado en otra pestaña.`);
  }
  const trimmed = description.trim();
  const nextDescription = trimmed === '' ? undefined : trimmed;
  all[name] = { ...all[name]!, description: nextDescription };
  writeAllProjects(all);
}

/**
 * Actualiza la portada de un proyecto guardado (ticket 056). Mismo
 * criterio que `updateProjectDescription` -- metadato, no toca
 * `updatedAt`. `coverImageDataUrl` de `undefined` quita la portada
 * (vuelve al placeholder genérico).
 */
export function updateProjectCover(name: string, coverImageDataUrl: string | undefined): void {
  const all = readAllProjects();
  if (!(name in all)) {
    throw new Error(`El proyecto "${name}" ya no existe -- puede que se haya eliminado en otra pestaña.`);
  }
  all[name] = { ...all[name]!, coverImageDataUrl };
  writeAllProjects(all);
}

/**
 * Quita UN mob de un proyecto guardado (ticket 058, menú "⋮" de cada
 * tarjeta de mob en "Proyecto") -- a diferencia de `deleteProject`
 * (borra el proyecto entero), esto solo elimina esa entrada de
 * `record.mobs`, dejando el resto del proyecto intacto. No-op seguro si
 * el mob no existe en ese proyecto (mismo criterio que `deleteProject`
 * con un proyecto inexistente -- eliminar algo que ya no está no es un
 * error). Se permite dejar el proyecto con CERO mobs -- mismo estado ya
 * soportado por "Agregar mobs" al mostrar un proyecto recién creado; no
 * se fuerza borrar el proyecto completo, esa es una decisión aparte con
 * su propio botón ("Eliminar proyecto").
 */
export function removeMobFromProject(name: string, mobId: string): void {
  const all = readAllProjects();
  const record = all[name];
  if (!record || !(mobId in record.mobs)) return;
  const mobs = { ...record.mobs };
  delete mobs[mobId];
  all[name] = { ...record, mobs };
  writeAllProjects(all);
}

/**
 * Actualiza la geometría/estado (y, desde el ticket 086, también el
 * PNG/resolución) de UN mob dentro de un proyecto -- a diferencia de
 * `renameProject`/`updateProjectDescription` (metadato, no tocan
 * `updatedAt`), esto SÍ refresca `updatedAt`: editar el modelo es
 * trabajo real hecho sobre el proyecto (mismo criterio que
 * `saveProject`), no un cambio de metadato. Lanza si el proyecto o el
 * mob ya no existen (mismo mensaje que `renameProject`/
 * `updateProjectDescription` -- probablemente se eliminó en otra
 * pestaña).
 *
 * Ticket 086 -- "Confirmar modelo" usa esta MISMA función para guardar
 * de una vez `geometryStatus: 'confirmado'`, la geometría con el atlas
 * ya aplicado, y el PNG en blanco recién generado (ver
 * `projectSnapshot.ts`, `buildConfirmedMobEntry`) -- todos los campos
 * son opcionales para que "guardar borrador" (ticket 083, solo
 * geometría) y "confirmar" (ticket 086, los 4 campos) reusen la misma
 * función sin necesitar dos funciones casi idénticas.
 *
 * Ticket 090 -- el editor de animación (Etapa 4) guarda `animations`
 * con esta MISMA función (mismo criterio: reusar en vez de duplicar un
 * "actualiza un campo de un mob dentro de un proyecto" casi idéntico).
 */
export function updateMobGeometry(
  name: string,
  mobId: string,
  update: Partial<Pick<ProjectMobEntry, 'geometryStatus' | 'customGeometry' | 'pngDataUrl' | 'resolution' | 'animations'>>,
): void {
  const all = readAllProjects();
  const record = all[name];
  if (!record || !(mobId in record.mobs)) {
    throw new Error(`El mob "${mobId}" ya no existe en el proyecto "${name}" -- puede que se haya eliminado en otra pestaña.`);
  }
  all[name] = {
    ...record,
    updatedAt: new Date().toISOString(),
    mobs: { ...record.mobs, [mobId]: { ...record.mobs[mobId]!, ...update } },
  };
  writeAllProjects(all);
}

/**
 * Duplica un proyecto guardado (ticket 053, menú "⋮" de "Mis proyectos") --
 * copia COMPLETA de `mobs` (mismos PNGs/resolución, sin volver a
 * codificar nada) bajo un nombre nuevo autogenerado, con `updatedAt`
 * propio (es un proyecto nuevo e independiente desde este momento, no
 * un alias -- editar la copia nunca debe afectar al original ni
 * viceversa).
 *
 * DECISION de este ticket (confirmada con Marco via `AskUserQuestion`,
 * no la ronda de "pedir nombre antes" -- ver `docs/ARQUITECTURA.md`,
 * "Ticket 053"): el nombre se autogenera al instante, sufijo
 * `" (copia)"`; si ya existe, incrementa a `" (copia 2)"`, `" (copia 3)"`,
 * etc. hasta encontrar uno libre -- nunca lanza `ProjectAlreadyExistsError`
 * por colisión de nombre generado (a diferencia de `saveProject`/
 * `renameProject`, que sí exigen que el LLAMADOR resuelva la colisión --
 * aca no hay llamador humano eligiendo el nombre, así que esta función
 * resuelve la colisión ella misma).
 *
 * Devuelve el nombre final asignado a la copia -- la UI lo usa para
 * confirmar/resaltar la tarjeta recién creada.
 */
export function duplicateProject(name: string): string {
  const all = readAllProjects();
  const record = all[name];
  if (!record) {
    throw new Error(`El proyecto "${name}" ya no existe -- puede que se haya eliminado en otra pestaña.`);
  }

  let candidate = `${name} (copia)`;
  let attempt = 2;
  while (candidate in all) {
    candidate = `${name} (copia ${attempt})`;
    attempt += 1;
  }

  all[candidate] = { updatedAt: new Date().toISOString(), mobs: { ...record.mobs } };
  writeAllProjects(all);
  return candidate;
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
