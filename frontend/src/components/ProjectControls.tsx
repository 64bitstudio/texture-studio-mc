import { useCallback, useState, type ChangeEvent, type CSSProperties } from 'react';
import type { TextureBuffer } from '../textureBuffer';
import type { MobGeometry } from '../types/baseAssets';
import { buildProjectSnapshot, restoreProjectBuffers } from '../projectSnapshot';
import { ProjectAlreadyExistsError, deleteProject, listProjects, loadProject, projectExists, saveProject } from '../projectStorage';

export interface ProjectControlsProps {
  /** Cache compartida de buffers por mob visitado en la sesion (ticket 018) -- fuente de lo que se guarda, y destino de lo que se carga. */
  bufferCache: Map<string, TextureBuffer>;
  /** Geometria por mob visitado en la sesion (ver `App.tsx`) -- necesaria para escalar `uvBoxes` al codificar cada PNG (ticket 015, via `encodeBufferToPngBlob`). */
  geometryCache: Map<string, MobGeometry>;
  /** Se llama tras cargar un proyecto con exito, con los ids de mob que quedaron en `bufferCache`. */
  onProjectLoaded: (loadedMobIds: string[]) => void;
}

const buttonStyle: CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'var(--panel-bg)',
  color: 'var(--text)',
  cursor: 'pointer',
};

const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  border: '1px solid rgba(255, 214, 89, 0.6)',
};

const inputStyle: CSSProperties = { fontSize: 12, padding: '4px 6px', minWidth: 140 };

/**
 * Guardar/listar/cargar/eliminar proyectos (ticket 019, HU-3/HU-4/HU-5).
 * Vive en `App.tsx` (no dentro de `Editor.tsx`): un proyecto agrupa
 * VARIOS mobs a la vez (ver formato en
 * `docs/definiciones/multi-mob-y-proyectos-guardados.md`), y `Editor` se
 * remonta por completo al cambiar de mob (`key={mobId}`, ticket 018) --
 * este control necesita sobrevivir esos remounts para seguir mostrando
 * la lista de proyectos sin importar que mob este activo.
 *
 * Confirmaciones (HU-3 "sobrescribir", HU-5 "eliminar"): DECISION de
 * este ticket -- confirmacion EN LINEA (reemplaza el boton por
 * "¿Seguro? Si/No" hasta que el usuario responde), NO `window.confirm`
 * nativo. Se probo primero con `window.confirm` (mas simple, cero UI
 * nueva) pero se descarto por un hallazgo real durante la revision en
 * vivo de este ticket (Claude in Chrome): un dialogo nativo bloquea el
 * hilo de JS de la pagina hasta que se resuelve, y la automatizacion de
 * este proyecto (via el protocolo de DevTools que usa Claude in Chrome)
 * no tiene forma de aceptarlo/cancelarlo -- la pestaña queda
 * completamente congelada (ni `Runtime.evaluate` ni `Input.dispatchMouseEvent`
 * responden) hasta cerrarla a la fuerza. Un modal nativo que ninguna
 * herramienta de QA automatizada de este equipo puede resolver es un
 * riesgo real para el checklist de cierre de CUALQUIER ticket futuro
 * que toque este control -- se opto por una confirmacion 100% en el
 * DOM de la pagina (totalmente scriptable) en vez de arriesgar ese
 * mismo bloqueo cada vez. Ver docs/ARQUITECTURA.md, "Ticket 019".
 */
export function ProjectControls({ bufferCache, geometryCache, onProjectLoaded }: ProjectControlsProps) {
  const [name, setName] = useState('');
  const [pending, setPending] = useState<'save' | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Ningun `useState`/cache dedicado para la lista en si: `listProjects()`
  // es una lectura pura y barata de `localStorage` -- `refreshTick` solo
  // fuerza un re-render de este componente (guardar/cargar/eliminar
  // mutan `localStorage` "por fuera" de React, que no se entera solo).
  const [refreshTick, setRefreshTick] = useState(0);
  const projects = listProjects();

  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  }, []);

  const performSave = useCallback(
    async (trimmedName: string, overwrite: boolean) => {
      setPending('save');
      try {
        const mobs = await buildProjectSnapshot(bufferCache, geometryCache);
        saveProject(trimmedName, mobs, { overwrite });
        setName('');
        setRefreshTick((t) => t + 1);
      } catch (err) {
        if (err instanceof ProjectAlreadyExistsError) {
          // Carrera extremadamente improbable (otra pestaña guardo el
          // mismo nombre entre el chequeo previo y este punto) -- se
          // reporta en vez de sobrescribir en silencio.
          setError(`${err.message} Vuelve a intentar guardar para confirmar la sobrescritura.`);
        } else {
          setError(err instanceof Error ? err.message : 'No se pudo guardar el proyecto.');
        }
      } finally {
        setPending(null);
      }
    },
    [bufferCache, geometryCache],
  );

  const handleSaveClick = useCallback(() => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Ingresa un nombre para el proyecto.');
      return;
    }
    if (bufferCache.size === 0) {
      setError('No hay ningún mob con contenido en memoria para guardar todavía.');
      return;
    }

    if (projectExists(trimmed)) {
      setConfirmOverwrite(trimmed);
      return;
    }
    void performSave(trimmed, false);
  }, [name, bufferCache, performSave]);

  const handleConfirmOverwrite = useCallback(() => {
    if (!confirmOverwrite) return;
    const trimmedName = confirmOverwrite;
    setConfirmOverwrite(null);
    void performSave(trimmedName, true);
  }, [confirmOverwrite, performSave]);

  const handleLoad = useCallback(
    async (projectName: string) => {
      setError(null);
      setPending(projectName);
      try {
        const record = loadProject(projectName);
        if (!record) {
          setError(`El proyecto "${projectName}" ya no existe -- puede que se haya eliminado en otra pestaña.`);
          setRefreshTick((t) => t + 1);
          return;
        }
        const restored = await restoreProjectBuffers(record.mobs);
        for (const [mobId, buffer] of restored.entries()) {
          bufferCache.set(mobId, buffer);
        }
        onProjectLoaded(Array.from(restored.keys()));
      } catch (err) {
        setError(err instanceof Error ? err.message : `No se pudo cargar el proyecto "${projectName}".`);
      } finally {
        setPending(null);
      }
    },
    [bufferCache, onProjectLoaded],
  );

  const handleConfirmDelete = useCallback((projectName: string) => {
    setError(null);
    try {
      deleteProject(projectName);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : `No se pudo eliminar el proyecto "${projectName}".`);
    } finally {
      setConfirmDelete(null);
    }
  }, []);

  return (
    <section aria-label="Proyectos guardados" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }} data-refresh-tick={refreshTick}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ color: 'var(--text-dim)' }}>Nombre del proyecto</span>
          <input type="text" value={name} placeholder="ej. Set Nether" aria-label="Nombre del proyecto" onChange={handleNameChange} style={inputStyle} />
        </label>
        <button type="button" style={{ ...buttonStyle, alignSelf: 'flex-end' }} disabled={pending !== null} onClick={handleSaveClick}>
          {pending === 'save' ? 'Guardando…' : 'Guardar'}
        </button>

        {confirmOverwrite && (
          <span
            role="alertdialog"
            aria-label={`Confirmar sobrescritura del proyecto ${confirmOverwrite}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}
          >
            <span>
              ¿Sobrescribir «{confirmOverwrite}»?
            </span>
            <button type="button" style={dangerButtonStyle} disabled={pending !== null} onClick={handleConfirmOverwrite}>
              Sí, sobrescribir
            </button>
            <button type="button" style={buttonStyle} disabled={pending !== null} onClick={() => setConfirmOverwrite(null)}>
              Cancelar
            </button>
          </span>
        )}
      </div>

      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            padding: '6px 8px',
            fontSize: 12,
            color: 'var(--text)',
            background: 'rgba(200, 60, 60, 0.25)',
            borderRadius: 4,
          }}
        >
          {error}
        </p>
      )}

      {projects.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {projects.map((project) => (
            <li
              key={project.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 6px',
                borderRadius: 4,
                background: 'var(--panel-bg)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.name}
                <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>{new Date(project.updatedAt).toLocaleString()}</span>
              </span>

              {confirmDelete === project.name ? (
                <span role="alertdialog" aria-label={`Confirmar eliminacion del proyecto ${project.name}`} style={{ display: 'flex', gap: 6 }}>
                  <span>¿Eliminar?</span>
                  <button type="button" style={dangerButtonStyle} onClick={() => handleConfirmDelete(project.name)}>
                    Sí, eliminar
                  </button>
                  <button type="button" style={buttonStyle} onClick={() => setConfirmDelete(null)}>
                    Cancelar
                  </button>
                </span>
              ) : (
                <>
                  <button type="button" style={buttonStyle} disabled={pending !== null} onClick={() => void handleLoad(project.name)}>
                    {pending === project.name ? 'Cargando…' : 'Cargar'}
                  </button>
                  <button type="button" style={buttonStyle} disabled={pending !== null} onClick={() => setConfirmDelete(project.name)}>
                    Eliminar
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
