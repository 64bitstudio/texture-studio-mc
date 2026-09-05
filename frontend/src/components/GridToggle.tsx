export interface GridToggleProps {
  visible: boolean;
  onToggle: (visible: boolean) => void;
}

/**
 * Muestra/oculta la cuadricula de pixeles superpuesta al editor de
 * textura (ticket 004, criterio "grid ajustable"). Decision de este
 * ticket: se ofrece mostrar/ocultar (checkbox), no un control adicional
 * de opacidad/grosor -- el ticket permitia cualquiera de las dos
 * alternativas, y un checkbox cubre el criterio sin agregar un control
 * redundante (ver docs/ARQUITECTURA.md, "Ticket 004"). Mismo patron de
 * `<label>` con texto visible que `SymmetryControls`.
 */
export function GridToggle({ visible, onToggle }: GridToggleProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={visible} onChange={(e) => onToggle(e.target.checked)} />
      Mostrar cuadricula
    </label>
  );
}
