import { useState } from 'react';
import { Button } from '../ui';
import { getTheme, toggleTheme, type Theme } from '../theme';

/**
 * Toggle de tema claro/oscuro (ticket 034, HU-5) -- botón compacto
 * (ícono + `aria-label`, nunca solo ícono sin nombre accesible, mismo
 * criterio del ticket 032) que alterna `theme.ts` (fuente de verdad
 * única, también usada por el selector de "Configuración", ticket 036).
 * El estado local (`theme`) solo espeja lo que ya aplicó `theme.ts` al
 * DOM -- sirve para re-renderizar el ícono correcto tras el click, no
 * para decidir el tema (eso lo decide `getTheme()`/`data-theme`).
 */
export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  function handleClick() {
    setThemeState(toggleTheme());
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
