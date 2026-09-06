import type { ComponentType } from 'react';
import { IconClock, IconFolder, IconPlus, type IconProps } from '../ui/icons';
import logoUrl from '../assets/brand/logo.png';
import sidebarBgUrl from '../assets/brand/sidebar-bg.png';

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

// Bug real encontrado en vivo (ticket 046, revisión 2): `sidebar-bg.png`
// es SIEMPRE oscura (asset fijo de Marco, sin variante clara) sin
// importar el tema activo -- usar `var(--text)`/`var(--text-dim)` para
// el texto del sidebar (que SÍ cambia con el tema) lo volvía ilegible
// en tema claro (texto oscuro sobre el fondo oscuro del sidebar).
// Texto del sidebar FIJO en tonos claros, igual que el ícono sobre
// `--accent` (mismo criterio ya aplicado más abajo): este componente
// deliberadamente NO sigue el tema de la app, es una superficie
// permanentemente oscura por diseño.
const SIDEBAR_TEXT = '#eef1f5';
const SIDEBAR_TEXT_DIM = 'rgba(238, 241, 245, 0.62)';

/**
 * Sidebar de navegación (ticket 037, HU-5) -- rediseño visual del
 * ticket 046 según el mockup nuevo entregado por Marco.
 *
 * Revisión 2 del ticket 046 (correcciones pedidas por Marco tras ver
 * el resultado en vivo):
 * - El fondo del sidebar ya NO es un gradiente CSS aproximado -- es el
 *   PNG real que Marco proveyó (`assets/brand/sidebar-bg.png`, recorte
 *   limpio sin esquinas redondeadas), aplicado como
 *   `background-image` de todo el `<nav>` (`cover`, anclado abajo a la
 *   izquierda -- ahí es donde vive el degradado de píxeles verdes).
 * - El logo ya NO es el ícono SVG dibujado a mano (`IconGrassBlockLogo`,
 *   eliminado -- ver `ui/icons.tsx`) -- es el PNG real que mandó Marco
 *   (`assets/brand/logo.png`, con transparencia real).
 * - Los items de navegación INACTIVOS ya NO tienen una caja/borde
 *   alrededor del ícono (confirmado contra la referencia, recorte
 *   ampliado: el ícono va suelto, sin caja) -- la caja sólida
 *   (`--accent`, ícono oscuro adentro) es EXCLUSIVA del item activo.
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
        background: `#0f171d url(${sidebarBgUrl}) no-repeat left bottom / cover`,
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        height: '100vh',
        overflowY: 'auto',
        color: SIDEBAR_TEXT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <img src={logoUrl} alt="" width={38} height={38} style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap' }}>Texture Studio MC</div>
          <div style={{ fontSize: 'var(--font-xs)', color: SIDEBAR_TEXT_DIM }}>Editor de texturas para Minecraft</div>
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
              border: isActive ? '1px solid var(--accent-soft-strong)' : '1px solid transparent',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              color: isActive ? 'var(--accent)' : SIDEBAR_TEXT,
              fontWeight: isActive ? 600 : 500,
            }}
          >
            {isActive ? (
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
                  background: 'var(--accent)',
                  // Fijo (no `var(--text)`/`var(--bg)`) -- mismo criterio que
                  // `.ui-button--primary` (`index.css`): el ícono se apoya
                  // SIEMPRE sobre `--accent`, que es claro en ambos temas, así
                  // que el contraste necesita un oscuro fijo, no uno que seguiría
                  // el tema activo.
                  color: '#0f171d',
                }}
              >
                <Icon size={16} />
              </span>
            ) : (
              <span aria-hidden="true" style={{ display: 'inline-flex', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={19} />
              </span>
            )}
            {label}
          </button>
        );
      })}

      <div style={{ marginTop: 'auto', paddingTop: 40 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            // Casi opaca (no solo un leve blur, ver revisión anterior) --
            // la referencia muestra la tarjeta claramente legible incluso
            // sobre la parte más intensa del degradado de píxeles verdes
            // de `sidebar-bg.png`.
            background: 'rgba(10, 16, 20, 0.88)',
          }}
        >
          <img src={logoUrl} alt="" width={28} height={28} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700 }}>Texture Studio MC</div>
            <div style={{ fontSize: 'var(--font-xs)', color: SIDEBAR_TEXT_DIM }}>Crea. Modifica. Comparte.</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
