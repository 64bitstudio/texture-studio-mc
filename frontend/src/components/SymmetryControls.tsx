export interface SymmetryControlsProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

/**
 * Toggle de simetria de pintura (ticket 004, HU-6). Un solo checkbox,
 * sin selector de eje: se ofrece un unico eje (espejo horizontal
 * dentro de la caja UV completa de cada parte del modelo) -- decision
 * documentada en `frontend/src/symmetry.ts` y en
 * `docs/ARQUITECTURA.md`, "Ticket 004" (un eje vertical solo seria
 * geometricamente coherente para la cabeza, no para torso/brazo/
 * pierna). El checkbox esta envuelto en un `<label>` con texto visible
 * -- nombre accesible nativo, sin necesitar `aria-label` aparte (mismo
 * patron que "Color libre" en `ColorPicker`).
 */
export function SymmetryControls({ enabled, onToggle }: SymmetryControlsProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
      Simetria horizontal (espejo dentro de cada region UV)
    </label>
  );
}
