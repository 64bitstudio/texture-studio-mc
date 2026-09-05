import type { CSSProperties } from 'react';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, clampZoom, zoomToPercent } from '../zoom';

export interface ZoomControlsProps {
  zoom: number;
  onChange: (zoom: number) => void;
}

/**
 * Botones +/- de zoom del editor de textura (ticket 004, HU-7). El
 * porcentaje mostrado usa 100% = 1 pixel CSS por texel (zoom=1) --
 * convencion estandar de editores de imagen. El zoom tambien se puede
 * ajustar con Ctrl/Cmd + rueda del mouse sobre el propio canvas (ver
 * `TextureEditor.tsx`) -- documentado aca porque es la eleccion de
 * modificador de este ticket (Ctrl/Cmd, no Shift ni rueda simple, para
 * no competir con el scroll normal de la pagina/panel lateral).
 * Botones solo-icono ("-"/"+") llevan `aria-label` por la regla de
 * accesibilidad del equipo.
 */
export function ZoomControls({ zoom, onChange }: ZoomControlsProps) {
  return (
    <div role="group" aria-label="Zoom del editor de textura" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        aria-label="Alejar zoom"
        title="Alejar (Ctrl/Cmd + rueda hacia abajo)"
        onClick={() => onChange(clampZoom(zoom - ZOOM_STEP))}
        disabled={zoom <= ZOOM_MIN}
        style={zoomButtonStyle(zoom <= ZOOM_MIN)}
      >
        −
      </button>
      <span aria-hidden="true" style={{ minWidth: 48, textAlign: 'center', fontSize: 13, color: 'var(--text-dim)' }}>
        {zoomToPercent(zoom)}%
      </span>
      <button
        type="button"
        aria-label="Acercar zoom"
        title="Acercar (Ctrl/Cmd + rueda hacia arriba)"
        onClick={() => onChange(clampZoom(zoom + ZOOM_STEP))}
        disabled={zoom >= ZOOM_MAX}
        style={zoomButtonStyle(zoom >= ZOOM_MAX)}
      >
        +
      </button>
    </div>
  );
}

function zoomButtonStyle(disabled: boolean): CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.25)',
    background: 'var(--panel-bg)',
    color: 'var(--text)',
    fontSize: 16,
    lineHeight: 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}
