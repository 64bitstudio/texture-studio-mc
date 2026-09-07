import { ZOOM_PRESETS, clampZoom, zoomToPercent } from '../zoom';
import { Select } from '../ui';

export interface ZoomControlsProps {
  zoom: number;
  onChange: (zoom: number) => void;
}

/**
 * Selector de zoom del editor de textura (ticket 004, HU-7; rediseñado
 * a pedido de Marco -- revisión en vivo del editor rediseñado, ticket
 * 072). Antes eran botones +/- con el porcentaje como texto fijo entre
 * ellos, con un piso de 400% -- Marco pidió explícitamente bajar hasta
 * 50% ("faltan las opciones 300, 200, 100 y 50"), lo que en la práctica
 * pedía una LISTA de niveles, no solo mover el piso de un stepper
 * continuo. Se reemplaza por un `<select>` de paradas fijas
 * (`ZOOM_PRESETS`, `zoom.ts`), mismo patrón visual que "Resolución" en
 * la misma barra de herramientas.
 *
 * El zoom continuo (Ctrl/Cmd + rueda del mouse sobre el canvas, ver
 * `TextureEditor.tsx`) sigue funcionando exactamente igual -- este
 * selector es un atajo a paradas comunes, no el único mecanismo de
 * zoom. Si el zoom actual no coincide con ninguna parada (llegó ahí por
 * rueda del mouse), el `<select>` simplemente no resalta ninguna
 * opción -- cosmético, no rompe nada (mismo comportamiento nativo que
 * cualquier `<select>` con un `value` fuera de sus `<option>`).
 */
export function ZoomControls({ zoom, onChange }: ZoomControlsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label htmlFor="editor-zoom" style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
        Zoom
      </label>
      <Select id="editor-zoom" value={zoom} onChange={(e) => onChange(clampZoom(Number(e.target.value)))} aria-label="Zoom del editor de textura" style={{ minWidth: 90 }}>
        {ZOOM_PRESETS.map((z) => (
          <option key={z} value={z}>
            {zoomToPercent(z)}%
          </option>
        ))}
      </Select>
    </div>
  );
}
