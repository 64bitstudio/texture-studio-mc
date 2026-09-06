import { Button } from '../ui';
import { IconMoon, IconSun } from '../ui/icons';
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
 * Toggle de tema claro/oscuro (ticket 034, HU-5) -- botón compacto.
 *
 * Ticket 046: `variant="icon-square"` (antes `"icon"`, ícono + texto
 * SIEMPRE visible) -- el mockup de referencia muestra solo el ícono en
 * una caja cuadrada. El texto/nombre accesible NO desaparece (regla
 * del ticket 032: "nunca un botón sin nombre accesible") -- sigue en
 * el DOM, solo oculto visualmente con `.sr-only`.
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
    <Button variant="icon-square" title={label} onClick={handleClick}>
      {isDark ? <IconSun /> : <IconMoon />}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
