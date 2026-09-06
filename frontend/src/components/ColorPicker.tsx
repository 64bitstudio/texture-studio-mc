import { MINECRAFT_PALETTE } from '../colors';
import { FormField } from '../ui';

export interface ColorPickerProps {
  /** Color actualmente seleccionado, como `#rrggbb`. */
  color: string;
  onChange: (hex: string) => void;
}

/**
 * Selector de color (HU-5): paleta predefinida "estilo Minecraft" +
 * selector libre (`<input type="color">` nativo -- cubre hex/RGB sin
 * construir un color picker custom, ver ticket 002 "no sobre-construyas").
 *
 * Ticket 026: los swatches de la paleta se dejan como `<button>` nativo
 * -- NO migran a `Button` (`ui/`) porque cada uno necesita un color de
 * fondo dinámico por swatch (`swatch.hex`), algo que las variantes fijas
 * de `Button` (primario/secundario/ícono/danger) no cubren y no
 * deberían cubrir (agregar una prop de color arbitrario a `Button`
 * rompería su propósito de tener un set cerrado de estilos
 * consistentes). El selector libre sí migra a `FormField`.
 */
export function ColorPicker({ color, onChange }: ColorPickerProps) {
  return (
    <div>
      <div
        role="group"
        aria-label="Paleta de colores predefinida estilo Minecraft"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}
      >
        {MINECRAFT_PALETTE.map((swatch) => {
          const selected = swatch.hex.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={swatch.hex}
              type="button"
              aria-label={`Color ${swatch.name} (${swatch.hex})`}
              aria-pressed={selected}
              title={swatch.name}
              onClick={() => onChange(swatch.hex)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                background: swatch.hex,
                border: selected ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.25)',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          );
        })}
      </div>

      <FormField label="Color libre" className="ui-field--inline">
        <input type="color" value={color} onChange={(e) => onChange(e.target.value)} style={{ cursor: 'pointer' }} />
      </FormField>
    </div>
  );
}
