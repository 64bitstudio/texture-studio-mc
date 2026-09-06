import type { ReactNode } from 'react';
import { Sidebar, type NavView } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { Avatar } from './Avatar';
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
 */
export function AppShell({ activeNav, onNavigate, displayName, theme, onThemeChange, onOpenSettings, children }: AppShellProps) {
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      <Sidebar activeNav={activeNav} onNavigate={onNavigate} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            flexShrink: 0,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Configuración"
            title="Configuración"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <Avatar displayName={displayName} />
          </button>
        </header>
        <main style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}>{children}</main>
      </div>
    </div>
  );
}
