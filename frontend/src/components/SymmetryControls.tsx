import { Checkbox } from '../ui';

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
 * pierna).
 *
 * Ticket 026: migrado a `Checkbox` (`ui/`) -- mismo markup que tenía
 * antes, ahora centralizado (compartía literalmente el mismo patrón
 * con `GridToggle`).
 */
export function SymmetryControls({ enabled, onToggle }: SymmetryControlsProps) {
  return (
    <Checkbox checked={enabled} onChange={onToggle}>
      Simetria horizontal (espejo dentro de cada region UV)
    </Checkbox>
  );
}
