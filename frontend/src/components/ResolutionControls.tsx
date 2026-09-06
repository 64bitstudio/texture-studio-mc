import type { ChangeEvent } from 'react';
import { RESOLUTION_MAX, RESOLUTION_MIN } from '../resolution';
import { FormField, Select } from '../ui';

export interface ResolutionControlsProps {
  resolution: number;
  /** Dimensiones NATIVAS del mob (x1) -- `geometry.textureWidth/Height`, ver `components/Editor.tsx`. */
  nativeWidth: number;
  nativeHeight: number;
  onChange: (resolution: number) => void;
}

/**
 * Selector de resolucion de trabajo x1-x10 (ticket 009). `<select>`
 * nativo envuelto en un `<label>` con texto visible -- mismo patron ya
 * usado por el resto de controles de formulario simples del editor
 * (`ColorPicker`, `ImportTextureControl`), sin introducir un segundo
 * tipo de control (slider, stepper custom) para un rango tan chico
 * (10 valores discretos).
 *
 * Ticket 025: segundo consumidor real de `frontend/src/ui/`
 * (`FormField`/`Select`) -- mismo patron visual, ahora centralizado.
 */
export function ResolutionControls({ resolution, nativeWidth, nativeHeight, onChange }: ResolutionControlsProps) {
  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    onChange(Number(e.target.value));
  }

  const options = [];
  for (let n = RESOLUTION_MIN; n <= RESOLUTION_MAX; n++) {
    options.push(n);
  }

  return (
    <FormField label="Resolucion de trabajo">
      <Select value={resolution} onChange={handleChange} aria-label="Resolucion de trabajo del editor de textura">
        {options.map((n) => (
          <option key={n} value={n}>
            ×{n} ({nativeWidth * n}×{nativeHeight * n})
          </option>
        ))}
      </Select>
    </FormField>
  );
}
