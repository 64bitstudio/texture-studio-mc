import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `'secondary'` (default) para acciones normales, `'primary'` para LA acción principal de un flujo, `'icon'` para botones compactos (ícono + texto corto). */
  variant?: 'secondary' | 'primary' | 'icon';
}

/**
 * Botón base del sistema de componentes (ticket 025, HU-4). Wrapper
 * delgado sobre `<button>` nativo -- no reinventa foco/teclado (gratis
 * con el elemento nativo), solo aplica estilo consistente vía las
 * clases `.ui-button*` de `index.css`. `type="button"` por default
 * (nunca "submit" implícito -- este proyecto no usa `<form>` nativos
 * con submit real, todos los controles llaman a su `onClick`/`onChange`
 * directamente).
 */
export function Button({ variant = 'secondary', className, type = 'button', ...rest }: ButtonProps) {
  const variantClass = variant === 'primary' ? 'ui-button--primary' : variant === 'icon' ? 'ui-button--icon' : '';
  const classes = ['ui-button', variantClass, className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
