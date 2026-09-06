import { Checkbox } from '../ui';

export interface GridToggleProps {
  visible: boolean;
  onToggle: (visible: boolean) => void;
}

/**
 * Muestra/oculta la cuadricula de pixeles superpuesta al editor de
 * textura (ticket 004, criterio "grid ajustable"). Decision de este
 * ticket: se ofrece mostrar/ocultar (checkbox), no un control adicional
 * de opacidad/grosor (ver docs/ARQUITECTURA.md, "Ticket 004").
 *
 * Ticket 026: migrado a `Checkbox` (`ui/`) -- ver `SymmetryControls.tsx`.
 */
export function GridToggle({ visible, onToggle }: GridToggleProps) {
  return (
    <Checkbox checked={visible} onChange={onToggle}>
      Mostrar cuadricula
    </Checkbox>
  );
}
