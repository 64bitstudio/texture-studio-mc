import { Button } from '../ui';
import { toggleTheme, type Theme } from '../theme';

export interface ThemeToggleProps {
  /**
   * Tema actual -- CONTROLADO desde `App.tsx` (ticket 036, bug real
   * encontrado en vivo: este componente tenía su propio `useState`
   * inicializado una sola vez con `getTheme()`, así que quedaba
   * desincronizado en cuanto el tema cambiaba desde OTRO lugar --
   * `Settings.tsx`, que también puede cambiar el tema. Levantar el
   * estado a `App.tsx`, la misma solución ya aplicada a `displayName`/
   * `Avatar`, es la única forma de que dos componentes hermanos que
   * comparten una preferencia queden siempre sincronizados sin inventar
   * un mecanismo de eventos.
   */
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

/**
 * Toggle de tema claro/oscuro (ticket 034, HU-5) -- botón compacto
 * (ícono + texto, nunca solo ícono, mismo criterio del ticket 032).
 */
export function ThemeToggle({ theme, onThemeChange }: ThemeToggleProps) {
  function handleClick() {
    onThemeChange(toggleTheme());
  }

  const isDark = theme === 'dark';
  // El texto/ícono describen la ACCIÓN (a qué tema cambia el click), no
  // el tema actual -- evita la ambigüedad de leer "Tema claro" mientras
  // el tema activo es justamente ese.
  const label = isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

  return (
    <Button variant="icon" title={label} onClick={handleClick}>
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
      {label}
    </Button>
  );
}
