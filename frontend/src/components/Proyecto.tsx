import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { Button, FormField, InlineError, Section, SearchSortToggleBar, type ToggleLayout } from '../ui';
import { IconDuplicate, IconExport, IconFolder, IconPencil, IconTrash } from '../ui/icons';
import { loadProject, updateProjectCover, updateProjectDescription } from '../projectStorage';
import { useProjectActions } from '../hooks/useProjectActions';
import { filterAndSortProjectMobs } from '../projectMobFilter';
import { MobEntryCard } from './MobEntryCard';
import type { MobSummary } from '../types/mobs';
import type { MobGeometry } from '../types/baseAssets';

export interface ProyectoProps {
  projectName: string;
  mobs: MobSummary[];
  /** Elegir un mob del proyecto para editarlo -- mismo `handleSelectMob` que ya usa el resto de la app (ticket 018/027), navega a `'editor'`. El editor real no cambia con este ticket -- confirmado explícito con Marco. */
  onSelectMob: (mobId: string) => void;
  /** Navega a `'agregar-mobs'` (ticket 042). */
  onAddMobs: () => void;
  /** El proyecto activo cambió de nombre -- `App.tsx` actualiza `activeProject.name`. */
  onProjectRenamed: (newName: string) => void;
  /** El proyecto activo se eliminó -- `App.tsx` navega de vuelta a "Mis proyectos" y limpia `activeProject`. */
  onProjectDeleted: () => void;
  /** Click en "Mis proyectos" del breadcrumb (ticket 056, nuevo) -- navega afuera sin eliminar ni cambiar nada del proyecto. */
  onBackToList: () => void;
}

/** Nombre legible de un mob a partir de su id -- mismo criterio que `MisProyectos.tsx`/`Recientes.tsx`. */
function mobLabelFor(mobId: string, mobs: MobSummary[]): string {
  return mobs.find((m) => m.id === mobId)?.label ?? mobId;
}

/**
 * Vista de detalle de "Proyecto" -- rediseño de layout del ticket 056
 * (ver `docs/definiciones/preview-2d-y-rediseno-proyecto.md`, VoBo de
 * Marco obtenido) sobre la pantalla original del ticket 041.
 *
 * Cambios de ESTE ticket: breadcrumb, portada subible
 * (`coverImageDataUrl`), título/descripción editables inline (misma
 * mecánica que ya tenía "Renombrar", generalizada), badge fijo
 * "Minecraft Java Edition" (mismo estilo que `NuevoProyecto.tsx`),
 * botones de header reposicionados, y un panel lateral de "Acciones"
 * que llama a `useProjectActions` -- la MISMA lógica que ya usa
 * `ProjectCard.tsx` (tickets 053/054) desde "Mis proyectos", extraída a
 * ese hook compartido en este ticket para no mantener una tercera copia
 * de renombrar/duplicar/exportar/eliminar.
 *
 * El grid de mobs de abajo sigue siendo el simple del ticket 041 (con
 * la miniatura 2D del ticket 055) -- el rediseño de las tarjetas
 * (buscador/orden/toggle/info adicional) es el ticket 057, deliberado
 * para no mezclar dos rediseños grandes en un mismo ticket.
 *
 * Explícitamente SIN CAMBIOS (confirmado con Marco): el editor de
 * texturas (`Editor.tsx`, con su visor 3D en vivo) -- `onSelectMob`
 * navega exactamente igual que siempre.
 */
export function Proyecto({ projectName, mobs, onSelectMob, onAddMobs, onProjectRenamed, onProjectDeleted, onBackToList }: ProyectoProps) {
  const [geometryCache] = useState(() => new Map<string, MobGeometry>());
  const { actionError, exporting, rename, duplicate, exportZip, remove, clearError } = useProjectActions(projectName);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(projectName);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [metaError, setMetaError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicatedName, setDuplicatedName] = useState<string | null>(null);
  // Ningún dato nuevo depende de esto -- solo fuerza un re-render tras
  // `updateProjectDescription`/`updateProjectCover`, que escriben
  // directo a `localStorage` sin pasar por ningún prop que ya cambie
  // (a diferencia de renombrar, que sí cambia `projectName` vía
  // `onProjectRenamed`). Mismo criterio ya usado en `MisProyectos.tsx`
  // (`refreshTick`).
  const [refreshTick, setRefreshTick] = useState(0);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [mobSearchText, setMobSearchText] = useState('');
  const [mobLayout, setMobLayout] = useState<ToggleLayout>('grid');

  const record = loadProject(projectName);
  const mobIds = record ? Object.keys(record.mobs) : [];
  const visibleMobIds = filterAndSortProjectMobs(mobIds, mobs, mobSearchText);

  const handleStartEditTitle = useCallback(() => {
    setTitleInput(projectName);
    clearError();
    setEditingTitle(true);
  }, [projectName, clearError]);

  const handleTitleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTitleInput(e.target.value);
  }, []);

  const handleConfirmTitle = useCallback(() => {
    const result = rename(titleInput);
    if (result.ok) {
      setEditingTitle(false);
      onProjectRenamed(titleInput.trim());
    }
  }, [rename, titleInput, onProjectRenamed]);

  const handleCancelTitle = useCallback(() => {
    setEditingTitle(false);
    clearError();
  }, [clearError]);

  const handleStartEditDescription = useCallback(() => {
    setDescriptionInput(record?.description ?? '');
    setMetaError(null);
    setEditingDescription(true);
  }, [record?.description]);

  const handleDescriptionInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setDescriptionInput(e.target.value);
  }, []);

  const handleConfirmDescription = useCallback(() => {
    try {
      updateProjectDescription(projectName, descriptionInput);
      setMetaError(null);
      setEditingDescription(false);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      console.error(`Proyecto.handleConfirmDescription: fallo guardando la descripción.`, err);
      setMetaError(err instanceof Error ? err.message : 'No se pudo guardar la descripción.');
    }
  }, [projectName, descriptionInput]);

  const handleCancelDescription = useCallback(() => {
    setEditingDescription(false);
    setMetaError(null);
  }, []);

  const handleCoverButtonClick = useCallback(() => {
    coverInputRef.current?.click();
  }, []);

  const handleCoverFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Permite volver a elegir el MISMO archivo despues (el evento
      // `change` no se dispara dos veces seguidas con el mismo valor).
      e.target.value = '';
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== 'string') {
          console.error('Proyecto.handleCoverFileChange: FileReader no devolvió una data URL de texto.', dataUrl);
          setMetaError('No se pudo leer la imagen de portada.');
          return;
        }
        try {
          updateProjectCover(projectName, dataUrl);
          setMetaError(null);
          setRefreshTick((t) => t + 1);
        } catch (err) {
          console.error('Proyecto.handleCoverFileChange: fallo guardando la portada.', err);
          setMetaError(err instanceof Error ? err.message : 'No se pudo guardar la portada.');
        }
      };
      reader.onerror = () => {
        console.error('Proyecto.handleCoverFileChange: fallo leyendo el archivo de portada.', reader.error);
        setMetaError('No se pudo leer el archivo de portada.');
      };
      reader.readAsDataURL(file);
    },
    [projectName],
  );

  const handleDuplicateFromPanel = useCallback(() => {
    const result = duplicate();
    if (result.ok) setDuplicatedName(result.name);
  }, [duplicate]);

  const handleConfirmDeleteFromPanel = useCallback(() => {
    const result = remove();
    if (result.ok) onProjectDeleted();
  }, [remove, onProjectDeleted]);

  if (!record) {
    return (
      <div style={{ padding: 24 }}>
        <InlineError message={`El proyecto "${projectName}" ya no existe -- puede que se haya eliminado en otra pestaña.`} />
      </div>
    );
  }

  void refreshTick; // solo dispara el re-render de arriba, ver su comentario -- no se usa directamente en el JSX.

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <nav aria-label="Ruta" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-dim)' }}>
        <button type="button" onClick={onBackToList} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
          Mis proyectos
        </button>
        <span> › </span>
        <span style={{ color: 'var(--text)' }}>{projectName}</span>
      </nav>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverFileChange} className="sr-only" aria-label="Subir imagen de portada del proyecto" />
        <button
          type="button"
          onClick={handleCoverButtonClick}
          title="Cambiar portada del proyecto"
          style={{
            width: 88,
            height: 88,
            flexShrink: 0,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-strong)',
            padding: 0,
            cursor: 'pointer',
            overflow: 'hidden',
            background: record.coverImageDataUrl ? `center / cover no-repeat url(${record.coverImageDataUrl})` : 'var(--chip-bg)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {!record.coverImageDataUrl && <IconFolder size={28} style={{ color: 'var(--text-dim)' }} />}
        </button>

        <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {editingTitle ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormField label="Nombre del proyecto">
                <input type="text" value={titleInput} onChange={handleTitleInputChange} aria-label="Nuevo nombre del proyecto" style={{ fontSize: 18, padding: '6px 10px' }} />
              </FormField>
              <Button variant="primary" onClick={handleConfirmTitle}>
                Guardar
              </Button>
              <Button onClick={handleCancelTitle}>Cancelar</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>{projectName}</h2>
              <Button variant="icon-square" title="Renombrar proyecto" onClick={handleStartEditTitle}>
                <IconPencil size={16} />
                <span className="sr-only">Renombrar proyecto</span>
              </Button>
            </div>
          )}

          {editingDescription ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
              <textarea
                value={descriptionInput}
                onChange={handleDescriptionInputChange}
                aria-label="Descripción del proyecto"
                placeholder="Describe brevemente este proyecto…"
                rows={2}
                style={{ fontSize: 13, padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="primary" onClick={handleConfirmDescription}>
                  Guardar
                </Button>
                <Button onClick={handleCancelDescription}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-dim)', maxWidth: 480 }}>
                {record.description ?? 'Sin descripción todavía.'}
              </p>
              <Button variant="icon-square" title="Editar descripción" onClick={handleStartEditDescription}>
                <IconPencil size={14} />
                <span className="sr-only">Editar descripción</span>
              </Button>
            </div>
          )}
          {metaError && <InlineError message={metaError} />}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text)', background: 'var(--chip-bg)', borderRadius: 10, padding: '6px 12px', whiteSpace: 'nowrap' }}>
            Minecraft Java Edition
          </span>
          <Button onClick={() => void exportZip()} disabled={exporting}>
            <IconExport size={16} /> {exporting ? 'Exportando…' : 'Exportar proyecto'}
          </Button>
          <Button variant="primary" onClick={onAddMobs}>
            + Agregar mob
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 20, alignItems: 'start' }}>
        <Section title={`Mobs de este proyecto (${mobIds.length})`}>
          {mobIds.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Este proyecto todavía no tiene mobs -- usa "Agregar mob".</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SearchSortToggleBar
                searchValue={mobSearchText}
                onSearchChange={setMobSearchText}
                searchPlaceholder="Buscar mobs…"
                searchAriaLabel="Buscar mobs de este proyecto por nombre"
                layout={mobLayout}
                onLayoutChange={setMobLayout}
              />

              {visibleMobIds.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Ningún mob coincide con la búsqueda.</p>
              ) : (
                <ul
                  style={
                    mobLayout === 'grid'
                      ? { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }
                      : { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }
                  }
                >
                  {visibleMobIds.map((mobId) => (
                    <MobEntryCard
                      key={mobId}
                      mobId={mobId}
                      label={mobLabelFor(mobId, mobs)}
                      pngDataUrl={record.mobs[mobId]!.pngDataUrl}
                      resolution={record.mobs[mobId]!.resolution}
                      layout={mobLayout}
                      geometryCache={geometryCache}
                      onEditTexture={() => onSelectMob(mobId)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </Section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Section title="Información del proyecto">
            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--font-sm)' }}>
              <div>
                <dt style={{ color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>Nombre</dt>
                <dd style={{ margin: 0 }}>{projectName}</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>Mobs</dt>
                <dd style={{ margin: 0 }}>{mobIds.length}</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>Última modificación</dt>
                <dd style={{ margin: 0 }}>{new Date(record.updatedAt).toLocaleString()}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Acciones">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button type="button" className="ui-menu__item" onClick={handleStartEditTitle}>
                <IconPencil size={16} /> Renombrar proyecto
              </button>
              <button type="button" className="ui-menu__item" onClick={handleDuplicateFromPanel}>
                <IconDuplicate size={16} /> Duplicar proyecto
              </button>
              <button type="button" className="ui-menu__item" onClick={() => void exportZip()} disabled={exporting}>
                <IconExport size={16} /> {exporting ? 'Exportando…' : 'Exportar proyecto'}
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 2px' }} />
              {confirmDelete ? (
                <div role="alertdialog" aria-label={`Confirmar eliminación del proyecto «${projectName}»`} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 6px' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-sm)' }}>¿Eliminar «{projectName}»? Esta acción no se puede deshacer.</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button variant="danger" onClick={handleConfirmDeleteFromPanel} style={{ flex: 1, justifyContent: 'center' }}>
                      Sí, eliminar
                    </Button>
                    <Button onClick={() => setConfirmDelete(false)} style={{ flex: 1, justifyContent: 'center' }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <button type="button" className="ui-menu__item" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>
                  <IconTrash size={16} /> Eliminar proyecto
                </button>
              )}
            </div>
            {duplicatedName && (
              <p style={{ margin: '8px 0 0', fontSize: 'var(--font-xs)', color: 'var(--accent)' }}>Se creó una copia: «{duplicatedName}» (en "Mis proyectos").</p>
            )}
            {actionError && <InlineError message={actionError} />}
          </Section>
        </div>
      </div>
    </div>
  );
}
