import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, clampZoom, zoomToPercent } from '../zoom';
import { Button } from '../ui';

export interface ZoomControlsProps {
  zoom: number;
  onChange: (zoom: number) => void;
}

/**
 * Botones +/- de zoom del editor de textura (ticket 004, HU-7). El
 * porcentaje mostrado usa 100% = 1 pixel CSS por texel (zoom=1). El
 * zoom tambien se puede ajustar con Ctrl/Cmd + rueda del mouse sobre el
 * propio canvas (ver `TextureEditor.tsx`). Botones solo-simbolo
 * ("−"/"+") llevan `aria-label` por la regla de accesibilidad del
 * equipo.
 *
 * Ticket 026: migrado a `Button` variant="icon" (`ui/`).
 */
export function ZoomControls({ zoom, onChange }: ZoomControlsProps) {
  return (
    <div role="group" aria-label="Zoom del editor de textura" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Button
        variant="icon"
        aria-label="Alejar zoom"
        title="Alejar (Ctrl/Cmd + rueda hacia abajo)"
        onClick={() => onChange(clampZoom(zoom - ZOOM_STEP))}
        disabled={zoom <= ZOOM_MIN}
      >
        −
      </Button>
      <span aria-hidden="true" style={{ minWidth: 48, textAlign: 'center', fontSize: 13, color: 'var(--text-dim)' }}>
        {zoomToPercent(zoom)}%
      </span>
      <Button
        variant="icon"
        aria-label="Acercar zoom"
        title="Acercar (Ctrl/Cmd + rueda hacia arriba)"
        onClick={() => onChange(clampZoom(zoom + ZOOM_STEP))}
        disabled={zoom >= ZOOM_MAX}
      >
        +
      </Button>
    </div>
  );
}
