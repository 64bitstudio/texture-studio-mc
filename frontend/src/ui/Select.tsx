import type { SelectHTMLAttributes } from 'react';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Wrapper de `<select>` nativo (ticket 025) -- mismo elemento por
 * debajo, foco/teclado/lector de pantalla gratis. Solo aplica la clase
 * `.ui-select` para estilo consistente; acepta cualquier prop nativa de
 * `<select>` (`value`, `onChange`, `aria-label`, `children` de
 * `<option>`, etc.) tal cual, sin envolver su API.
 */
export function Select({ className, ...rest }: SelectProps) {
  const classes = ['ui-select', className].filter(Boolean).join(' ');
  return <select className={classes} {...rest} />;
}
