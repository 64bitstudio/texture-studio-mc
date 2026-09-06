import type { ReactNode } from 'react';

export interface FormFieldProps {
  /** Texto visible del label -- nunca solo `placeholder` (regla de accesibilidad del equipo). */
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * `<label>` + control, mismo patrón que ya usaban `ColorPicker`/
 * `ResolutionControls`/etc. antes del ticket 025 (envolver el input),
 * ahora centralizado. Deliberadamente NO usa `htmlFor`/`id` generado --
 * envolver el control dentro del `<label>` asocia el texto sin
 * necesitar coordinar un `id` único por instancia, mismo criterio ya
 * validado en los controles existentes.
 */
export function FormField({ label, children, className }: FormFieldProps) {
  const classes = ['ui-field', className].filter(Boolean).join(' ');
  return (
    <label className={classes}>
      <span className="ui-field__label">{label}</span>
      {children}
    </label>
  );
}
