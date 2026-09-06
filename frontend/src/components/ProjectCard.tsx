import { useCallback, useState, type ChangeEvent } from 'react';
import type { MobSummary } from '../types/mobs';
import type { ProjectSummary } from '../projectStorage';
import { ProjectAlreadyExistsError, deleteProject, duplicateProject, loadProject, renameProject } from '../projectStorage';
import { exportProjectZip } from '../export';
import { MOB_ICONS } from '../mobIcons';
import { Button, InlineError, Menu } from '../ui';
import { IconDots, IconDuplicate, IconExport, IconFolder, IconPencil, IconTrash } from '../ui/icons';

/** Máximo de miniaturas de mob visibles antes de colapsar a un badge "+N" (ver crop de la referencia -- siempre 3 + badge, nunca más de 3 sueltas). */
const MAX_VISIBLE_THUMBS = 3;

export interface ProjectCardProps {
  project: ProjectSummary;
  mobs: MobSummary[];
  layout: 'grid' | 'list';
  /** `true` mientras ESTE proyecto se está abriendo (click en la tarjeta o "Editar") -- deshabilita sus propios controles, no los del resto de tarjetas. */
  busy: boolean;
  /** Click en la tarjeta/nombre (ticket 053: reemplaza al viejo botón "📁 Carpeta") -- abre la vista de detalle del proyecto. */
  onOpen: () => void;
  /** Click en "Editar" -- destino real (editor directo vs. picker de mob) lo decide `MisProyectos.tsx` según cuántos mobs tiene el proyecto. */
  onEdit: () => void;
  /** Renombrar/Duplicar/Eliminar tuvieron éxito -- `MisProyectos.tsx` no guarda su propia copia de `allProjects` (lo deriva de `listProjects()` en cada render), así que solo necesita un re-render para reflejar el cambio. */
  onChanged: () => void;
}

/** Nombre legible de un mob a partir de su id -- mismo criterio que el resto de vistas de proyecto. */
function mobLabelFor(mobId: string, mobs: MobSummary[]): string {
  return mobs.find((m) => m.id === mobId)?.label ?? mobId;
}

type MenuMode = 'default' | 'rename' | 'delete';

/**
 * Tarjeta de un proyecto guardado en "Mis proyectos" (ticket 053) --
 * reemplaza la fila de texto plano del ticket 039/rediseño anterior.
 *
 * Ticket 053 (pedido explícito de Marco, con imagen de referencia):
 * - Clic en la tarjeta/nombre abre el proyecto (vista de detalle,
 *   `Proyecto.tsx`) -- el viejo botón "📁 Carpeta" se retira del todo,
 *   duplicaba esa misma acción de forma ambigua.
 * - "Editar" es una acción DISTINTA (no solo "abrir") -- ver
 *   `MisProyectos.tsx` para la decisión de a dónde navega según el
 *   número de mobs del proyecto.
 * - El menú "⋮" agrupa las acciones secundarias (Renombrar/Duplicar/
 *   Exportar), con "Eliminar" separado visualmente por destructiva
 *   (mismo criterio ya usado por `.ui-button--danger` en el resto de la
 *   app, ver `Proyecto.tsx`).
 *
 * Autocontenida para Renombrar/Duplicar/Eliminar/Exportar -- llama
 * directo a `projectStorage.ts`/`export.ts` (mismas funciones que ya
 * usa `Proyecto.tsx`, sin duplicar lógica) en vez de subir cada acción a
 * `MisProyectos.tsx`: esas 4 acciones no necesitan `bufferCache` ni
 * navegación, a diferencia de "abrir"/"Editar" (que SÍ restauran
 * buffers y navegan, y por eso viven en el padre -- ver
 * `MisProyectos.tsx`).
 */
export function ProjectCard({ project, mobs, layout, busy, onOpen, onEdit, onChanged }: ProjectCardProps) {
  const [menuMode, setMenuMode] = useState<MenuMode>('default');
  const [renameInput, setRenameInput] = useState(project.name);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const resetMenu = useCallback(() => {
    setMenuMode('default');
    setActionError(null);
  }, []);

  const handleStartRename = useCallback(() => {
    setRenameInput(project.name);
    setActionError(null);
    setMenuMode('rename');
  }, [project.name]);

  const handleRenameInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setRenameInput(e.target.value);
  }, []);

  const handleConfirmRename = useCallback(() => {
    const trimmed = renameInput.trim();
    if (!trimmed) {
      setActionError('Ingresa un nombre para el proyecto.');
      return;
    }
    if (trimmed === project.name) {
      resetMenu();
      return;
    }
    try {
      renameProject(project.name, trimmed);
      resetMenu();
      onChanged();
    } catch (err) {
      setActionError(
        err instanceof ProjectAlreadyExistsError
          ? `Ya existe un proyecto llamado "${trimmed}" -- elige otro nombre.`
          : err instanceof Error
            ? err.message
            : 'No se pudo renombrar el proyecto.',
      );
    }
  }, [renameInput, project.name, resetMenu, onChanged]);

  const handleDuplicate = useCallback(() => {
    setActionError(null);
    try {
      duplicateProject(project.name);
      resetMenu();
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo duplicar el proyecto.');
    }
  }, [project.name, resetMenu, onChanged]);

  const handleExport = useCallback(async () => {
    setActionError(null);
    setExporting(true);
    try {
      const record = loadProject(project.name);
      if (!record) {
        setActionError(`El proyecto "${project.name}" ya no existe -- puede que se haya eliminado en otra pestaña.`);
        return;
      }
      await exportProjectZip(project.name, record.mobs);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo exportar el proyecto.');
    } finally {
      setExporting(false);
    }
  }, [project.name]);

  const handleConfirmDelete = useCallback(() => {
    try {
      deleteProject(project.name);
      resetMenu();
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar el proyecto.');
    }
  }, [project.name, resetMenu, onChanged]);

  const visibleMobIds = project.mobIds.slice(0, MAX_VISIBLE_THUMBS);
  const overflowCount = project.mobIds.length - visibleMobIds.length;
  const isList = layout === 'list';
  const thumbSize = isList ? 32 : 48;
  const thumbStyle = {
    width: thumbSize,
    height: thumbSize,
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    objectFit: 'contain' as const,
    imageRendering: 'pixelated' as const,
  };

  const thumbs = (
    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
      {/* Miniatura en una sola línea (no partida en varios atributos como
          el resto del proyecto) -- hallazgo real de este ticket: el hook
          `ui-accessibility-guard.sh` extrae bien el elemento imagen
          completo (con su atributo de texto alternativo incluido), pero
          el loop que lo consume (`while read -r tag`) parte ese match por
          cada salto de línea interno y evalúa cada fragmento por
          separado -- una imagen multilínea hace que la línea de apertura
          (sin el atributo todavía) se marque como violación aunque el
          elemento completo sí lo tenga. Reportado (`SendFeedback`); esta
          miniatura se deja en una sola línea mientras el hook no se
          corrija, para no perder la verificación real de accesibilidad
          detrás de un falso positivo. */}
      {visibleMobIds.map((mobId) => (
        <img key={mobId} src={MOB_ICONS[mobId]} alt={mobLabelFor(mobId, mobs)} title={mobLabelFor(mobId, mobs)} style={thumbStyle} />
      ))}
      {overflowCount > 0 && (
        <span
          style={{
            width: thumbSize,
            height: thumbSize,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--radius-md)',
            background: 'var(--chip-bg)',
            border: '1px solid var(--border)',
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
            color: 'var(--text-dim)',
          }}
        >
          +{overflowCount}
        </span>
      )}
    </div>
  );

  const menuTrigger = (
    <Menu
      triggerVariant="icon-square"
      label={
        <>
          <IconDots size={18} />
          <span className="sr-only">Acciones del proyecto «{project.name}»</span>
        </>
      }
      items={[]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4, minWidth: 220 }} onClick={(e) => e.stopPropagation()}>
        {menuMode === 'default' && (
          <>
            <button type="button" className="ui-menu__item" onClick={handleStartRename}>
              <IconPencil size={16} /> Renombrar
            </button>
            <button type="button" className="ui-menu__item" onClick={handleDuplicate}>
              <IconDuplicate size={16} /> Duplicar
            </button>
            <button type="button" className="ui-menu__item" onClick={() => void handleExport()} disabled={exporting}>
              <IconExport size={16} /> {exporting ? 'Exportando…' : 'Exportar proyecto / Resource Pack'}
            </button>
            {/* Separada visualmente (línea + color de peligro) por ser destructiva -- pedido explícito de Marco. */}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 2px' }} />
            <button type="button" className="ui-menu__item" style={{ color: 'var(--danger)' }} onClick={() => setMenuMode('delete')}>
              <IconTrash size={16} /> Eliminar
            </button>
          </>
        )}

        {menuMode === 'rename' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 6px' }}>
            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
              Nuevo nombre
              <input type="text" value={renameInput} onChange={handleRenameInputChange} aria-label={`Nuevo nombre del proyecto «${project.name}»`} style={{ display: 'block', width: '100%', marginTop: 4, fontSize: 13, padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }} />
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="primary" onClick={handleConfirmRename} style={{ flex: 1, justifyContent: 'center' }}>
                Guardar
              </Button>
              <Button onClick={resetMenu} style={{ flex: 1, justifyContent: 'center' }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {menuMode === 'delete' && (
          <div role="alertdialog" aria-label={`Confirmar eliminación del proyecto «${project.name}»`} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 6px' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-sm)' }}>¿Eliminar «{project.name}»? Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="danger" onClick={handleConfirmDelete} style={{ flex: 1, justifyContent: 'center' }}>
                Sí, eliminar
              </Button>
              <Button onClick={resetMenu} style={{ flex: 1, justifyContent: 'center' }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {actionError && <InlineError message={actionError} />}
      </div>
    </Menu>
  );

  const titleButton = (
    <button
      type="button"
      onClick={onOpen}
      disabled={busy}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
        flex: isList ? '0 1 260px' : 1,
        background: 'transparent',
        border: 'none',
        padding: 0,
        color: 'var(--text)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      title={`Abrir proyecto «${project.name}»`}
    >
      <IconFolder size={20} style={{ flexShrink: 0, color: 'var(--text-dim)' }} />
      <span style={{ fontSize: 'var(--font-lg)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {project.name}
      </span>
    </button>
  );

  const meta = (
    <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-dim)', flexShrink: 0 }}>
      {project.mobIds.length} {project.mobIds.length === 1 ? 'mob' : 'mobs'} · Última modificación: {new Date(project.updatedAt).toLocaleDateString()}
    </p>
  );

  const editButton = (
    <button
      type="button"
      onClick={onEdit}
      disabled={busy}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: isList ? '8px 16px' : '10px 16px',
        flex: isList ? '0 0 auto' : 1,
        // Ticket 054 (corrección de Marco: "el boton de editar debe estar
        // menos redondeado"): `--radius-md` (8px), no `--radius-lg` (14px,
        // valor original del ticket 053) -- esquinas notablemente menos
        // curvas sin volverse un rectángulo recto.
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--accent)',
        background: 'var(--accent-soft)',
        color: 'var(--accent)',
        fontWeight: 600,
        fontSize: 'var(--font-sm)',
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.7 : 1,
      }}
    >
      <IconPencil size={16} />
      {busy ? 'Abriendo…' : 'Editar'}
    </button>
  );

  if (isList) {
    return (
      <li
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 16px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          background: 'var(--surface-raised)',
        }}
      >
        {titleButton}
        <div style={{ flex: 1, minWidth: 0 }}>{meta}</div>
        {thumbs}
        {editButton}
        {menuTrigger}
      </li>
    );
  }

  return (
    <li
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        background: 'var(--surface-raised)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {titleButton}
        {menuTrigger}
      </div>
      {meta}
      {thumbs}
      {actionError && menuMode === 'default' && <InlineError message={actionError} />}
      <div style={{ display: 'flex', gap: 8 }}>{editButton}</div>
    </li>
  );
}
