import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { Button, FormField, InlineError, Section, SearchSortToggleBar, type ToggleLayout } from '../ui';
import { IconClock, IconDocument, IconDuplicate, IconExport, IconFolder, IconModel, IconPencil, IconPlus, IconTrash } from '../ui/icons';
import { getMobGeometryStatus, loadProject, removeMobFromProject, updateProjectCover, updateProjectDescription } from '../projectStorage';
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
  /** Menú "⋮" -> "Editar modelo 3D" (ticket 083) -- navega a `'editor-modelo'` para ese mob. */
  onEditModel: (mobId: string) => void;
  /** Menú "⋮" -> "Editar animaciones" (ticket 090) -- navega a `'editor-animacion'` para ese mob. */
  onEditAnimations: (mobId: string) => void;
  /** Navega a `'agregar-mobs'` (ticket 042). */
  onAddMobs: () => void;
  /** El proyecto activo cambió de nombre -- `App.tsx` actualiza `activeProject.name`. */
  onProjectRenamed: (newName: string) => void;
  /** El proyecto activo se eliminó -- `App.tsx` navega de vuelta a "Mis proyectos" y limpia `activeProject`. */
  onProjectDeleted: () => void;
  /**
   * Se quitó UN mob del proyecto activo (ticket 058, menú "⋮" de una
   * tarjeta) -- `App.tsx` actualiza `activeProject.mobIds` para que
   * `AgregarMobs.tsx`/el selector de mob del editor dejen de considerar
   * a ese mob parte del proyecto (bug real encontrado en vivo: sin este
   * callback, `activeProject.mobIds` quedaba desactualizado).
   */
  onMobRemoved: (mobId: string) => void;
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
export function Proyecto({ projectName, mobs, onSelectMob, onEditModel, onEditAnimations, onAddMobs, onProjectRenamed, onProjectDeleted, onMobRemoved, onBackToList }: ProyectoProps) {
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

  // Ticket 058: menú "⋮" de cada tarjeta de mob -- "Eliminar mob del
  // proyecto". Mismo criterio de `refreshTick` que la descripción/
  // portada de arriba: `record` se deriva fresco en cada render, así
  // que solo hace falta forzar el re-render tras escribir.
  const handleRemoveMob = useCallback(
    (mobId: string) => {
      removeMobFromProject(projectName, mobId);
      setRefreshTick((t) => t + 1);
      onMobRemoved(mobId);
    },
    [projectName, onMobRemoved],
  );

  if (!record) {
    return (
      <div style={{ padding: 24 }}>
        <InlineError message={`El proyecto "${projectName}" ya no existe -- puede que se haya eliminado en otra pestaña.`} />
      </div>
    );
  }

  void refreshTick; // solo dispara el re-render de arriba, ver su comentario -- no se usa directamente en el JSX.

  return (
    <div className="ts-fade-in" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Ticket 061 (corrección de Marco sobre el 060: el espaciado que
          pedía NO era vertical -- era el espacio entre cada texto y el
          separador "›". `gap` en un flex en vez de espacios literales
          dentro del texto (que dependían de que el navegador no los
          colapsara) -- espaciado explícito y consistente. */}
      <nav aria-label="Ruta" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={onBackToList} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
          Mis proyectos
        </button>
        <span aria-hidden="true">›</span>
        <span style={{ color: 'var(--text)' }}>{projectName}</span>
      </nav>

      {/* Ticket 066 (pedido de Marco): separador debajo del breadcrumb. */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverFileChange} className="sr-only" aria-label="Subir imagen de portada del proyecto" />
        {/* Ticket 063 (pedido de Marco, con imagen de referencia): portada
            más grande (88px -> 120px) para que se note más en el header. */}
        <button
          type="button"
          onClick={handleCoverButtonClick}
          title="Cambiar portada del proyecto"
          style={{
            width: 120,
            height: 120,
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
          {!record.coverImageDataUrl && <IconFolder size={38} style={{ color: 'var(--text-dim)' }} />}
        </button>

        {/* Ticket 064 (pedido de Marco): más espacio vertical entre los 3
            textos (título/resumen/descripción) -- 6px se veía apretado. */}
        <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              <Button variant="icon-plain" title="Renombrar proyecto" onClick={handleStartEditTitle}>
                <IconPencil size={16} />
                <span className="sr-only">Renombrar proyecto</span>
              </Button>
            </div>
          )}

          {/* Ticket 063 (pedido de Marco, con imagen de referencia): línea
              compacta de "N mobs · Última modificación: fecha" debajo del
              título -- mismo formato ya usado por `ProjectCard.tsx` en
              "Mis proyectos" (singular/plural + separador "·"). */}
          <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
            {mobIds.length} {mobIds.length === 1 ? 'mob' : 'mobs'} · Última modificación: {new Date(record.updatedAt).toLocaleString()}
          </p>

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
            // Ticket 064 (pedido de Marco: "el texto del ultimo alinealo
            // con su boton de edicion") -- `alignItems: 'center'` en vez
            // de `'flex-start'`: con una sola línea de texto, "arriba"
            // dejaba el ícono (centrado dentro de su propia caja de 28px)
            // visualmente más abajo que el texto. Mismo criterio que la
            // fila del título, que ya usaba `'center'`.
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-dim)', maxWidth: 480 }}>
                {record.description ?? 'Sin descripción todavía.'}
              </p>
              <Button variant="icon-plain" title="Editar descripción" onClick={handleStartEditDescription}>
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

      {/* Ticket 065 (pedido de Marco, con imagen de referencia): el
          buscador + el toggle grid/lista pasan a compartir fila con el
          encabezado "Mobs de este proyecto (N)" EN TODO EL ANCHO del
          contenido (no solo la columna izquierda) -- así el buscador
          queda "hasta la derecha" de verdad, a la misma altura donde
          empieza la card lateral, en vez de encima solo de la columna
          de mobs. La grid de 2 columnas (mobs | panel lateral) empieza
          justo debajo, con `alignItems: 'start'` para que la card
          lateral quede a la MISMA altura que las tarjetas de mob (ver
          ticket 063: esa card ya no envuelve al buscador). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 className="ui-section__title" style={{ margin: 0 }}>
          Mobs de este proyecto ({mobIds.length})
        </h3>
        {mobIds.length > 0 && (
          <SearchSortToggleBar
            searchValue={mobSearchText}
            onSearchChange={setMobSearchText}
            searchPlaceholder="Buscar mobs…"
            searchAriaLabel="Buscar mobs de este proyecto por nombre"
            layout={mobLayout}
            onLayoutChange={setMobLayout}
          />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 20, alignItems: 'start' }}>
        <div>
          {mobIds.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Este proyecto todavía no tiene mobs -- usa "Agregar mob".</p>
          ) : (
            <>
              {visibleMobIds.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Ningún mob coincide con la búsqueda.</p>
              ) : (
                <ul
                  style={
                    mobLayout === 'grid'
                      ? { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }
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
                      geometryStatus={getMobGeometryStatus(record.mobs[mobId]!)}
                      onEditTexture={() => onSelectMob(mobId)}
                      onEditModel={() => onEditModel(mobId)}
                      onEditAnimations={() => onEditAnimations(mobId)}
                      customGeometry={record.mobs[mobId]!.customGeometry}
                      onRemoveMob={() => handleRemoveMob(mobId)}
                    />
                  ))}
                  {/* Tarjeta "Agregar mob" (ticket 058, imagen de referencia) -- mismo destino que el botón del header, solo un segundo punto de entrada más visible dentro de la cuadrícula/lista. */}
                  <li>
                    <button
                      type="button"
                      onClick={onAddMobs}
                      style={
                        mobLayout === 'grid'
                          ? { width: '100%', height: '100%', minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }
                          : { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }
                      }
                    >
                      <IconPlus size={mobLayout === 'grid' ? 24 : 16} />
                      <span style={mobLayout === 'grid' ? { fontWeight: 600 } : undefined}>{mobLayout === 'grid' ? 'Agregar mob' : 'Agregar mob a este proyecto'}</span>
                      {/* Ticket 061 (pedido de Marco): subtítulo solo en
                          la card de grid -- en modo lista es una barra
                          angosta, no una "card", y el texto no cabe. */}
                      {mobLayout === 'grid' && <span style={{ fontSize: 'var(--font-xs)' }}>Añade un nuevo mob a este proyecto.</span>}
                    </button>
                  </li>
                </ul>
              )}
            </>
          )}
        </div>

        {/* Ticket 065 (pedido de Marco): "Información del proyecto" y
            "Acciones" pasan de ser 2 cards separadas a UNA sola card con
            una división interna -- mismo `<Section>`, ahora con AMBOS
            sub-encabezados y un separador (`<div>` de 1px, mismo criterio
            ya usado dentro de "Acciones" para separar "Eliminar
            proyecto"). `style={{ background: 'var(--surface-raised)' }}`
            -- hallazgo real de Marco: `--panel-bg` (el fondo por defecto
            de `.ui-section`) es IGUAL a `--bg` (el fondo de toda la
            pantalla) en ambos temas, así que esta card se veía "sin
            fondo" (solo el borde) -- se fuerza el mismo fondo que ya
            usan las tarjetas de mob (`--surface-raised`) para que se
            vea como una card real. */}
        <Section style={{ background: 'var(--surface-raised)' }}>
          {/* Ticket 067 (pedido de Marco, con imagen de referencia):
              homologa el diseño de esta card -- encabezados en texto
              normal/negrita (no mayúsculas con tracking, ese estilo es
              `.ui-section__title` compartido con el resto de la app,
              ej. "Mobs de este proyecto (N)"; esta card usa un override
              local en vez de tocar esa clase global) y cada fila con un
              ícono más grande al lado de un bloque de 2 líneas
              (etiqueta chica arriba, valor abajo) en vez del ícono
              inline junto a la etiqueta. */}
          <h3 style={{ margin: 0, fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text)' }}>
            Información del proyecto
          </h3>
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 'var(--font-sm)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <IconFolder size={20} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <div>
                <dt style={{ margin: 0, color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>Nombre</dt>
                <dd style={{ margin: 0 }}>{projectName}</dd>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <IconModel size={20} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <div>
                <dt style={{ margin: 0, color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>Mobs</dt>
                <dd style={{ margin: 0 }}>{mobIds.length}</dd>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <IconClock size={20} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <div>
                <dt style={{ margin: 0, color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>Última modificación</dt>
                <dd style={{ margin: 0 }}>{new Date(record.updatedAt).toLocaleString()}</dd>
              </div>
            </div>
            {/* Ticket 067 (pedido de Marco, con imagen de referencia):
                nueva fila "Descripción" -- el dato ya existía
                (`record.description`, ticket 056), solo faltaba
                mostrarlo también aquí (antes solo se veía/editaba en el
                header). Mismo fallback que el header cuando no hay
                descripción todavía. */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <IconDocument size={20} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <div>
                <dt style={{ margin: 0, color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>Descripción</dt>
                <dd style={{ margin: 0 }}>{record.description ?? 'Sin descripción todavía.'}</dd>
              </div>
            </div>
          </dl>

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          <h3 style={{ margin: 0, fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text)' }}>
            Acciones
          </h3>
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
            {/* Ticket 066 (pedido de Marco): quitar el separador que
                iba aquí, arriba de "Eliminar proyecto". */}
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
  );
}
