import { Button, FormField, Select } from '../ui';

export interface EraseControlsProps {
  active: boolean;
  onToggle: (active: boolean) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
}

export const ERASE_BRUSH_SIZE_MIN = 1;
export const ERASE_BRUSH_SIZE_MAX = 5;

/**
 * Botón "Borrar" + tamaño de pincel (ticket 030, HU-5). Activar el modo
 * hace que pintar (click/arrastrar sobre la cuadrícula) escriba
 * transparente en vez del color de la paleta -- ver `Editor.tsx`
 * (`paintMode`) y `brush.ts` (`computeBrushFootprint`, el tamaño de
 * pincel expande el punto pintado a un bloque N×N). El selector de
 * tamaño solo aparece con el modo activo (no aplica si no se está
 * borrando).
 *
 * Ticket 032 (HU-7): ícono 🗑 junto al texto (nunca solo ícono, ver
 * `aria-hidden` -- el texto sigue siendo el nombre accesible real) y
 * fundido corto (`ts-fade-in`) al aparecer el selector de tamaño.
 */
export function EraseControls({ active, onToggle, brushSize, onBrushSizeChange }: EraseControlsProps) {
  const sizes: number[] = [];
  for (let n = ERASE_BRUSH_SIZE_MIN; n <= ERASE_BRUSH_SIZE_MAX; n++) sizes.push(n);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Button variant={active ? 'primary' : 'secondary'} aria-pressed={active} onClick={() => onToggle(!active)}>
        <span aria-hidden="true">🗑</span>
        {active ? 'Borrar (activo)' : 'Borrar'}
      </Button>
      {active && (
        <div className="ts-fade-in">
          <FormField label="Tamaño de pincel">
            <Select value={brushSize} onChange={(e) => onBrushSizeChange(Number(e.target.value))} aria-label="Tamaño del pincel de borrado">
              {sizes.map((n) => (
                <option key={n} value={n}>
                  {n}×{n}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      )}
    </div>
  );
}
