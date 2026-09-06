import { Button } from '../ui';

/** Los 3 destinos reales del sidebar (ticket 037) -- 'proyecto'/'agregar-mobs'/'configuracion' se alcanzan DESDE estos, no son items propios del sidebar. */
export type NavView = 'nuevo-proyecto' | 'mis-proyectos' | 'recientes';

export interface SidebarProps {
  /** `null` cuando la vista activa no corresponde a ningún item del sidebar (ej. dentro de un proyecto, o en Configuración) -- ninguno queda resaltado en ese caso. */
  activeNav: NavView | null;
  onNavigate: (view: NavView) => void;
}

const NAV_ITEMS: Array<{ id: NavView; label: string; icon: string }> = [
  { id: 'nuevo-proyecto', label: 'Nuevo proyecto', icon: '➕' },
  { id: 'mis-proyectos', label: 'Mis proyectos', icon: '📁' },
  { id: 'recientes', label: 'Recientes', icon: '🕐' },
];

/**
 * Sidebar de navegación (ticket 037, HU-5) -- según el mockup de
 * referencia entregado por Marco: logo/nombre arriba, 3 destinos con el
 * activo resaltado, tarjeta de marca al pie. Reemplaza la pantalla de
 * inicio única del ticket 027 (dos secciones apiladas) por navegación
 * persistente de verdad.
 */
export function Sidebar({ activeNav, onNavigate }: SidebarProps) {
  return (
    <nav
      aria-label="Navegación principal"
      style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        gap: 4,
        background: 'var(--panel-bg)',
        borderRight: '1px solid var(--border)',
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      <h1 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>Texture Studio MC</h1>

      {NAV_ITEMS.map((item) => (
        <Button
          key={item.id}
          variant={activeNav === item.id ? 'primary' : 'secondary'}
          aria-current={activeNav === item.id ? 'page' : undefined}
          onClick={() => onNavigate(item.id)}
          style={{ justifyContent: 'flex-start' }}
        >
          <span aria-hidden="true">{item.icon}</span> {item.label}
        </Button>
      ))}

      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: 'var(--text-dim)',
          paddingTop: 16,
          borderTop: '1px solid var(--border)',
        }}
      >
        <span aria-hidden="true">🧱</span>
        <span>Texture Studio MC — Crea. Modifica. Comparte.</span>
      </div>
    </nav>
  );
}
