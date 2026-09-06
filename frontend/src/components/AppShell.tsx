import type { ReactNode } from 'react';
import { Sidebar, type NavView } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { Avatar } from './Avatar';
import { Button } from '../ui';
import { IconSettings } from '../ui/icons';
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
 * Shell de navegación nueva (ticket 037, HU-5) -- sidebar fijo +
 * header con tema/configuración/avatar, envolviendo TODAS las vistas
 * excepto el editor (que conserva su propio header dedicado, sin
 * cambios -- ver `App.tsx`). Sigue sin router (mismo criterio del
 * ticket 027): `activeNav`/`onNavigate` son estado interno de
 * `App.tsx`, no URLs.
 *
 * Ticket 046 (rediseño visual): los 3 controles de la derecha pasan a
 * botones cuadrados con ícono (`variant="icon-square"`, `ui/Button`) --
 * el texto sigue presente para lectores de pantalla (`.sr-only`, nunca
 * se quita el nombre accesible, mismo criterio del ticket 032), solo
 * se oculta visualmente para que se vea como el mockup de referencia.
 *
 * DECISIÓN de este ticket: "Configuración" pasa a ser un control
 * PROPIO (antes vivía escondido detrás de un click en el avatar, sin
 * ícono/etiqueta visible de "Configuración" -- ver `docs/ARQUITECTURA.md`,
 * "Ticket 046"). El avatar deja de abrir Configuración -- vuelve a ser
 * puramente decorativo (`Avatar.tsx`, sin cambios), como en cualquier
 * indicador de identidad -- Configuración sigue 100% alcanzable, ahora
 * por su propio botón correctamente etiquetado.
 */
export function AppShell({ activeNav, onNavigate, displayName, theme, onThemeChange, onOpenSettings, children }: AppShellProps) {
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      <Sidebar activeNav={activeNav} onNavigate={onNavigate} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            flexShrink: 0,
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
          <Button variant="icon-square" title="Configuración" onClick={onOpenSettings}>
            <IconSettings />
            <span className="sr-only">Configuración</span>
          </Button>
          <Avatar displayName={displayName} />
        </header>
        <main style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}>{children}</main>
      </div>
    </div>
  );
}
