import type { ReactNode } from 'react';
import { Sidebar, type NavView } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { Avatar } from './Avatar';
import { Button } from '../ui';
import { IconSettings } from '../ui/icons';
import logoUrl from '../assets/brand/logo.png';
import type { Theme } from '../theme';

export interface AppShellProps {
  activeNav: NavView | null;
  onNavigate: (view: NavView) => void;
  displayName: string;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onOpenSettings: () => void;
  children: ReactNode;
}

/**
 * Shell de navegación nueva (ticket 037, HU-5) -- topbar + sidebar
 * fijos, envolviendo TODAS las vistas excepto el editor (que conserva
 * su propio header dedicado, sin cambios -- ver `App.tsx`). Sigue sin
 * router (mismo criterio del ticket 027): `activeNav`/`onNavigate` son
 * estado interno de `App.tsx`, no URLs.
 *
 * Ticket 048 (corrección pedida por Marco tras ver el resultado del
 * 046/047 en vivo: "el logo superior debe estar en una topbar al igual
 * que los íconos de tema/configuración/perfil"): el logo/marca vivía
 * arriba del `Sidebar` (columna vertical); ahora vive en una topbar
 * COMPARTIDA que cruza todo el ancho de la ventana (logo a la
 * izquierda, los 3 controles a la derecha), con el `Sidebar` (ya sin
 * su bloque de marca -- ver ese archivo) y el contenido viviendo
 * DEBAJO de esa topbar, no al costado. Mismo criterio de colores que
 * ya tenía este header (tokens de tema, NO fijos como `Sidebar.tsx`)
 * -- a diferencia del sidebar, esta topbar no lleva la imagen de fondo
 * de Marco, así que sí puede seguir el tema activo sin problema.
 *
 * DECISIÓN del ticket 046: "Configuración" es un control PROPIO (antes
 * vivía escondido detrás de un click en el avatar) -- el avatar es
 * puramente decorativo (`Avatar.tsx`).
 */
export function AppShell({ activeNav, onNavigate, displayName, theme, onThemeChange, onOpenSettings, children }: AppShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <header
        style={{
          flexShrink: 0,
          height: 68,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel-bg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logoUrl} alt="" width={34} height={34} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap' }}>Texture Studio MC</div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>Editor de texturas para Minecraft</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
          <Button variant="icon-square" title="Configuración" onClick={onOpenSettings}>
            <IconSettings />
            <span className="sr-only">Configuración</span>
          </Button>
          <Avatar displayName={displayName} />
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Sidebar activeNav={activeNav} onNavigate={onNavigate} />
        <main style={{ flex: 1, minWidth: 0, overflow: 'auto', position: 'relative' }}>{children}</main>
      </div>
    </div>
  );
}
