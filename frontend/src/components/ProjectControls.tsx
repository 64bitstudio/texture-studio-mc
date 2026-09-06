import { useCallback, useState, type ChangeEvent } from 'react';
import type { TextureBuffer } from '../textureBuffer';
import type { MobGeometry } from '../types/baseAssets';
import { buildProjectSnapshot, restoreProjectBuffers } from '../projectSnapshot';
import { ProjectAlreadyExistsError, deleteProject, listProjects, loadProject, projectExists, saveProject } from '../projectStorage';
import { Button, FormField, InlineError } from '../ui';

export interface ProjectControlsProps {
  /** Cache compartida de buffers por mob visitado en la sesion (ticket 018) -- fuente de lo que se guarda, y destino de lo que se carga. */
  bufferCache: Map<string, TextureBuffer>;
  /** Geometria por mob visitado en la sesion (ver `App.tsx`) -- necesaria para escalar `uvBoxes` al codificar cada PNG (ticket 015, via `encodeBufferToPngBlob`). */
  geometryCache: Map<string, MobGeometry>;
  /** Se llama tras cargar un proyecto con exito, con los ids de mob que quedaron en `bufferCache`. */
  onProjectLoaded: (loadedMobIds: string[]) => void;
}

/**
 * Guardar/listar/cargar/eliminar proyectos (ticket 019, HU-3/HU-4/HU-5).
 * Vive en `App.tsx` (no dentro de `Editor.tsx`): un proyecto agrupa
 * VARIOS mobs a la vez, y `Editor` se remonta por completo al cambiar
 * de mob (`key={mobId}`, ticket 018) -- este control necesita sobrevivir
 * esos remounts para seguir mostrando la lista de proyectos.
 *
 * Confirmaciones (HU-3 "sobrescribir", HU-5 "eliminar"): confirmación EN
 * LÍNEA (reemplaza el botón por "¿Seguro? Sí/No"), NUNCA `window.confirm`
 * nativo -- congela la pestaña de Claude in Chrome sin forma de
 * responder (ver memoria `texture-studio-mc-sin-dialogos-nativos` y
 * docs/ARQUITECTURA.md, "Ticket 019").
 *
 * Ticket 026: migrado a `FormField`+`Button` (variantes `primary`/
 * `danger`)+`InlineError` (`ui/`) -- mismo comportamiento exacto,
 * `dangerButtonStyle`/`buttonStyle`/`inputStyle` ad-hoc de este archivo
 * se eliminan (reemplazados por `Button` variant="danger"/`FormField`).
 *
 * Ticket 032 (HU-7): "Guardar" gana ícono 💾 junto al texto.
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
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <FormField label="Nombre del proyecto">
          <input type="text" value={name} placeholder="ej. Set Nether" aria-label="Nombre del proyecto" onChange={handleNameChange} style={{ fontSize: 12, padding: '4px 6px', minWidth: 140 }} />
        </FormField>
        <Button disabled={pending !== null} onClick={handleSaveClick}>
          <span aria-hidden="true">💾</span>
          {pending === 'save' ? 'Guardando…' : 'Guardar'}
        </Button>

        {confirmOverwrite && (
          <span
            role="alertdialog"
            aria-label={`Confirmar sobrescritura del proyecto ${confirmOverwrite}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>¿Sobrescribir «{confirmOverwrite}»?</span>
            <Button variant="danger" disabled={pending !== null} onClick={handleConfirmOverwrite}>
              Sí, sobrescribir
            </Button>
            <Button disabled={pending !== null} onClick={() => setConfirmOverwrite(null)}>
              Cancelar
            </Button>
          </span>
        )}
      </div>

      {error && <InlineError message={error} />}

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
                  <Button variant="danger" onClick={() => handleConfirmDelete(project.name)}>
                    Sí, eliminar
                  </Button>
                  <Button onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                </span>
              ) : (
                <>
                  <Button disabled={pending !== null} onClick={() => void handleLoad(project.name)}>
                    {pending === project.name ? 'Cargando…' : 'Cargar'}
                  </Button>
                  <Button disabled={pending !== null} onClick={() => setConfirmDelete(project.name)}>
                    Eliminar
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
