import { MINECRAFT_PALETTE } from '../colors';

export interface ColorPickerProps {
  /** Color actualmente seleccionado, como `#rrggbb`. */
  color: string;
  onChange: (hex: string) => void;
}

/**
 * Selector de color (HU-5): paleta predefinida "estilo Minecraft" +
 * selector libre (`<input type="color">` nativo -- cubre hex/RGB sin
 * construir un color picker custom, ver ticket 002 "no sobre-construyas").
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

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }}>
        Color libre
        <input type="color" value={color} onChange={(e) => onChange(e.target.value)} style={{ cursor: 'pointer' }} />
      </label>
    </div>
  );
}
