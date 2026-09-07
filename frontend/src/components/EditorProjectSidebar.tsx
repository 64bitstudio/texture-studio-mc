import { IconFolder, IconModel, IconPlus } from '../ui/icons';
import { SIDEBAR_TEXT_DIM } from './Sidebar';

export interface EditorProjectSidebarMob {
  id: string;
  label: string;
}

export interface EditorProjectSidebarProps {
  projectName: string;
  mobs: EditorProjectSidebarMob[];
  activeMobId: string;
  onSelectMob: (mobId: string) => void;
  /** Click en la tarjeta del proyecto -- vuelve a la vista de detalle (`Proyecto.tsx`), mismo destino que el breadcrumb del editor. */
  onBackToProject: () => void;
  onAddMob: () => void;
}

/**
 * Contenido de `Sidebar.extraContent` cuando el editor está activo
 * (ticket 072, pedido de Marco con imagen de referencia): tarjeta
 * "Proyecto actual" + lista de "Mobs del proyecto" (con el mob activo
 * resaltado, click para cambiar de mob) -- reemplaza al selector de
 * pestañas (`MobSelector.tsx`) que antes vivía en la topbar dedicada
 * del editor (retirada en este ticket, ver `App.tsx`).
 *
 * Deliberadamente SIN nombre personalizado por mob (confirmado con
 * Marco vía `AskUserQuestion`: la imagen de referencia mostraba un
 * "Carcomido" distinto de "Creeper" -- eso es el soporte multi-skin ya
 * descartado en la definición original del rediseño, `docs/
 * definiciones/preview-2d-y-rediseno-proyecto.md`) -- cada fila muestra
 * únicamente el nombre real del mob (ej. "Creeper").
 */
export function EditorProjectSidebar({ projectName, mobs, activeMobId, onSelectMob, onBackToProject, onAddMob }: EditorProjectSidebarProps) {
  // Pedido de Marco ("animaciones y transiciones a todo", sutiles): los
  // 3 botones de abajo usan clases CSS (`.ts-sidebar-*`, `index.css`)
  // en vez de `background`/`border`/`color` inline -- un valor inline
  // siempre gana sobre una regla `:hover` de la hoja de estilos, asi
  // que el hover con transicion no podia aplicar mientras esos 3
  // colores siguieran siendo estilo inline. Los valores de reposo/
  // activo NO cambiaron, solo se movieron.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: SIDEBAR_TEXT_DIM, marginBottom: 8 }}>
          Proyecto actual
        </div>
        <button
          type="button"
          onClick={onBackToProject}
          className="ts-sidebar-project-card"
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 10, borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left' }}
        >
          <IconFolder size={18} style={{ flexShrink: 0, color: SIDEBAR_TEXT_DIM }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectName}</div>
            <div style={{ fontSize: 'var(--font-xs)', color: SIDEBAR_TEXT_DIM }}>
              {mobs.length} {mobs.length === 1 ? 'mob' : 'mobs'}
            </div>
          </div>
        </button>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: SIDEBAR_TEXT_DIM, marginBottom: 8 }}>
          Mobs del proyecto
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {mobs.map((mob) => {
            const isActive = mob.id === activeMobId;
            return (
              <button
                key={mob.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectMob(mob.id)}
                className={`ts-sidebar-mob-item${isActive ? ' ts-sidebar-mob-item--active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', fontWeight: isActive ? 600 : 500 }}
              >
                <IconModel size={16} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--font-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mob.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onAddMob}
            className="ts-sidebar-add-mob"
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left' }}
          >
            <IconPlus size={14} />
            <span style={{ fontSize: 'var(--font-sm)' }}>Agregar mob</span>
          </button>
        </div>
      </div>
    </div>
  );
}
