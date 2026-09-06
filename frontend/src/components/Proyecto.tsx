import { useCallback, useState, type ChangeEvent } from 'react';
import { Button, FormField, InlineError, Section } from '../ui';
import { ProjectAlreadyExistsError, deleteProject, loadProject, renameProject } from '../projectStorage';
import { exportProjectZip } from '../export';
import type { MobSummary } from '../types/mobs';

export interface ProyectoProps {
  projectName: string;
  mobs: MobSummary[];
  /** Elegir un mob del proyecto para editarlo -- mismo `handleSelectMob` que ya usa el resto de la app (ticket 018/027), navega a `'editor'`. */
  onSelectMob: (mobId: string) => void;
  /** Navega a `'agregar-mobs'` (ticket 042). */
  onAddMobs: () => void;
  /** El proyecto activo cambió de nombre -- `App.tsx` actualiza `activeProject.name`. */
  onProjectRenamed: (newName: string) => void;
  /** El proyecto activo se eliminó -- `App.tsx` navega de vuelta a "Mis proyectos" y limpia `activeProject`. */
  onProjectDeleted: () => void;
}

/** Nombre legible de un mob a partir de su id -- mismo criterio que `MisProyectos.tsx`/`Recientes.tsx`. */
function mobLabelFor(mobId: string, mobs: MobSummary[]): string {
  return mobs.find((m) => m.id === mobId)?.label ?? mobId;
}

/**
 * Vista de detalle de "Proyecto" (ticket 041, HU-2) -- pieza central
 * del flujo nuevo: punto de llegada desde "Nuevo proyecto"/"Mis
 * proyectos"/"Recientes" (038/039/040), punto de partida hacia el
 * editor y "Agregar mobs" (042), y ahora tambien hacia exportar el
 * proyecto completo (044).
 *
 * Lee el registro COMPLETO del proyecto con `loadProject` en cada
 * render (fresco desde `localStorage`, mismo criterio que
 * `MisProyectos.tsx`/`Recientes.tsx`) en vez de confiar en el
 * `activeProject.mobIds` de `App.tsx` (que es solo un resumen liviano
 * poblado al navegar aquí) -- así la lista de mobs siempre refleja la
 * verdad actual, incluso si cambió por otro medio.
 *
 * La miniatura de cada mob es literalmente su PNG guardado
 * (`pngDataUrl`, ya una `data:` URL válida como `src` de `<img>`) --
 * no hace falta decodificarlo a un `TextureBuffer` solo para mostrar
 * una vista chica, y este proyecto no tiene ningún otro asset de
 * miniatura/ícono por mob (ver `MobSelector.tsx`/`NuevoProyecto.tsx`,
 * ambos solo texto).
 *
 * Ticket 044 (HU-4): "Exportar proyecto (.zip)" ya no esta deshabilitado
 * -- llama a `exportProjectZip(projectName, record.mobs)`, que decodifica
 * DIRECTAMENTE cada `pngDataUrl` ya guardado (sin re-decodificar a
 * `TextureBuffer`/re-codificar, ver `export.ts`). REEMPLAZA a la vieja
 * exportacion de "solo el mob activo del editor" (retirada de
 * `ExportControls.tsx` en este mismo ticket) -- esta es ahora la UNICA
 * forma de exportar un `.zip` en la app.
 */
export function Proyecto({ projectName, mobs, onSelectMob, onAddMobs, onProjectRenamed, onProjectDeleted }: ProyectoProps) {
  const [renameInput, setRenameInput] = useState(projectName);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const record = loadProject(projectName);
  const mobIds = record ? Object.keys(record.mobs) : [];

  const handleRenameInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setRenameInput(e.target.value);
  }, []);

  const handleStartRename = useCallback(() => {
    setRenameInput(projectName);
    setRenameError(null);
    setRenaming(true);
  }, [projectName]);

  const handleCancelRename = useCallback(() => {
    setRenaming(false);
    setRenameError(null);
  }, []);

  const handleConfirmRename = useCallback(() => {
    const trimmed = renameInput.trim();
    if (!trimmed) {
      setRenameError('Ingresa un nombre para el proyecto.');
      return;
    }
    if (trimmed === projectName) {
      setRenaming(false);
      return;
    }
    try {
      renameProject(projectName, trimmed);
      setRenaming(false);
      onProjectRenamed(trimmed);
    } catch (err) {
      if (err instanceof ProjectAlreadyExistsError) {
        setRenameError(`Ya existe un proyecto llamado "${trimmed}" -- elige otro nombre.`);
      } else {
        setRenameError(err instanceof Error ? err.message : 'No se pudo renombrar el proyecto.');
      }
    }
  }, [renameInput, projectName, onProjectRenamed]);

  const handleOpenConfirmDelete = useCallback(() => {
    setConfirmDelete(true);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setConfirmDelete(false);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    try {
      deleteProject(projectName);
      onProjectDeleted();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar el proyecto.');
      setConfirmDelete(false);
    }
  }, [projectName, onProjectDeleted]);

  const handleExportProject = useCallback(async () => {
    if (!record) return;
    setExportError(null);
    setExporting(true);
    try {
      await exportProjectZip(projectName, record.mobs);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'No se pudo exportar el proyecto.');
    } finally {
      setExporting(false);
    }
  }, [projectName, record]);

  if (!record) {
    return (
      <div style={{ padding: 24 }}>
        <InlineError message={`El proyecto "${projectName}" ya no existe -- puede que se haya eliminado en otra pestaña.`} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {renaming ? (
          <>
            <FormField label="Nombre del proyecto">
              <input
                type="text"
                value={renameInput}
                onChange={handleRenameInputChange}
                aria-label="Nuevo nombre del proyecto"
                style={{ fontSize: 16, padding: '4px 8px' }}
              />
            </FormField>
            <Button variant="primary" onClick={handleConfirmRename}>
              Guardar nombre
            </Button>
            <Button onClick={handleCancelRename}>Cancelar</Button>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0 }}>Proyecto: {projectName}</h2>
            <Button variant="icon" title="Renombrar proyecto" onClick={handleStartRename}>
              <span aria-hidden="true">✏️</span> Renombrar
            </Button>
          </>
        )}
      </div>
      {renameError && <InlineError message={renameError} />}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={onAddMobs}>
          <span aria-hidden="true">➕</span> Agregar mobs
        </Button>
        <Button onClick={() => void handleExportProject()} disabled={exporting}>
          <span aria-hidden="true">📦</span> {exporting ? 'Exportando proyecto…' : 'Exportar proyecto (.zip)'}
        </Button>
        {confirmDelete ? (
          <span role="alertdialog" aria-label="Confirmar eliminación de proyecto" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>¿Eliminar «{projectName}»? Esta acción no se puede deshacer.</span>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Sí, eliminar
            </Button>
            <Button onClick={handleCancelDelete}>Cancelar</Button>
          </span>
        ) : (
          <Button variant="danger" onClick={handleOpenConfirmDelete}>
            <span aria-hidden="true">🗑</span> Eliminar proyecto
          </Button>
        )}
      </div>
      {deleteError && <InlineError message={deleteError} />}
      {exportError && <InlineError message={exportError} />}

      <Section title={`Mobs de este proyecto (${mobIds.length})`}>
        {mobIds.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Este proyecto todavía no tiene mobs -- usa "Agregar mobs".</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {mobIds.map((mobId) => (
              <Button
                key={mobId}
                onClick={() => onSelectMob(mobId)}
                style={{ flexDirection: 'column', alignItems: 'center', gap: 6, padding: 8, height: 'auto' }}
              >
                <img
                  src={record.mobs[mobId]!.pngDataUrl}
                  alt={`Miniatura de la textura guardada de ${mobLabelFor(mobId, mobs)}`}
                  style={{ width: 48, height: 24, imageRendering: 'pixelated', border: '1px solid var(--border-strong)', borderRadius: 2 }}
                />
                <span>{mobLabelFor(mobId, mobs)}</span>
              </Button>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
