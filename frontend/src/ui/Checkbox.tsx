import type { ReactNode } from 'react';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

/**
 * Checkbox con label a la derecha (ticket 026, hallazgo real durante el
 * refactor: `SymmetryControls`/`GridToggle` tenían el MISMO markup
 * literal -- `<label style={display:flex,alignItems:center,gap:8,...}>`
 * -- repetido palabra por palabra en ambos archivos). Se extrae aquí en
 * vez de dejarlo duplicado, mismo criterio que el resto de `ui/`. No
 * estaba en el alcance original del ticket 025 (que listaba Button/
 * FormField/Select/Section/Menu/LoadingOverlay) -- se agrega en el 026
 * porque ahí es donde se detectó la duplicación real, no antes.
 */
export function Checkbox({ checked, onChange, children }: CheckboxProps) {
  return (
    <label className="ui-checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}
