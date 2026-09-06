import type { ComponentType } from 'react';
import { IconClock, IconFolder, IconGrassBlockLogo, IconPlus, type IconProps } from '../ui/icons';

/** Los 3 destinos reales del sidebar (ticket 037) -- 'proyecto'/'agregar-mobs'/'configuracion' se alcanzan DESDE estos, no son items propios del sidebar. */
export type NavView = 'nuevo-proyecto' | 'mis-proyectos' | 'recientes';

export interface SidebarProps {
  /** `null` cuando la vista activa no corresponde a ningún item del sidebar (ej. dentro de un proyecto, o en Configuración) -- ninguno queda resaltado en ese caso. */
  activeNav: NavView | null;
  onNavigate: (view: NavView) => void;
}

const NAV_ITEMS: Array<{ id: NavView; label: string; Icon: ComponentType<IconProps> }> = [
  { id: 'nuevo-proyecto', label: 'Nuevo proyecto', Icon: IconPlus },
  { id: 'mis-proyectos', label: 'Mis proyectos', Icon: IconFolder },
  { id: 'recientes', label: 'Recientes', Icon: IconClock },
];

/**
 * Sidebar de navegación (ticket 037, HU-5) -- rediseño visual del
 * ticket 046 según el mockup nuevo entregado por Marco: bloque de
 * marca (ícono + título + subtítulo) arriba, 3 destinos con ícono en
 * caja propia + estado activo (relleno/borde de acento), tarjeta de
 * marca al pie con fondo decorativo sutil.
 *
 * Los items de navegación son `<button>` planos en vez de `Button`
 * (`ui/`) -- el look de "relleno translúcido de acento + ícono en caja
 * propia" del mockup diverge bastante del sistema de variants
 * (`secondary`/`primary`) de ese componente; se reusa igual la clase
 * `.ui-button` (sin variant) SOLO por su `:focus-visible`/transición/
 * cursor ya compartidos, con el resto de estilos inline (mismo
 * criterio de "estilos inline por componente, CSS solo para lo
 * realmente reusable" ya establecido en este archivo/`AppShell.tsx`).
 */
export function Sidebar({ activeNav, onNavigate }: SidebarProps) {
  return (
    <nav
      aria-label="Navegación principal"
      style={{
        width: 272,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
        gap: 4,
        background: 'var(--panel-bg)',
        borderRight: '1px solid var(--border)',
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <IconGrassBlockLogo size={38} />
        <div>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap' }}>Texture Studio MC</div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>Editor de texturas para Minecraft</div>
        </div>
      </div>

      {NAV_ITEMS.map(({ id, label, Icon }) => {
        const isActive = activeNav === id;
        return (
          <button
            key={id}
            type="button"
            className="ui-button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            style={{
              width: '100%',
              justifyContent: 'flex-start',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 'var(--radius-lg)',
              border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text)',
              fontWeight: isActive ? 600 : 500,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                flexShrink: 0,
                borderRadius: 'var(--radius-sm)',
                background: isActive ? 'var(--accent)' : 'var(--surface-raised)',
                color: isActive ? '#0b0e13' : 'var(--text-dim)',
                border: isActive ? 'none' : '1px solid var(--border)',
              }}
            >
              <Icon size={16} />
            </span>
            {label}
          </button>
        );
      })}

      <div style={{ marginTop: 'auto', position: 'relative', paddingTop: 40 }}>
        {/* Fondo decorativo sutil (mockup de referencia) -- puramente
            ornamental, `aria-hidden`/`pointer-events: none`, no afecta
            el layout ni la navegación por teclado. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 0% 100%, var(--accent-soft), transparent 65%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            background: 'var(--panel-bg)',
          }}
        >
          <IconGrassBlockLogo size={28} />
          <div>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700 }}>Texture Studio MC</div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>Crea. Modifica. Comparte.</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
