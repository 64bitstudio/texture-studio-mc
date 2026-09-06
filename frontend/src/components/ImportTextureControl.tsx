import type { ChangeEvent } from 'react';
import { FormField, InlineError } from '../ui';

export interface ImportTextureControlProps {
  expectedWidth: number;
  expectedHeight: number;
  error: string | null;
  onFileSelected: (file: File) => void;
}

/**
 * Control de UI para importar un PNG existente como punto de partida
 * (ticket 005, HU-8). Campo de archivo simple (no drag&drop -- ver
 * docs/ARQUITECTURA.md, "Ticket 005", para la justificación completa).
 * El mensaje de error se muestra inline con `role="alert"` -- nunca un
 * aviso nativo del navegador.
 *
 * Ticket 026: migrado a `FormField`+`InlineError` (`ui/`).
 */
export function ImportTextureControl({ expectedWidth, expectedHeight, error, onFileSelected }: ImportTextureControlProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Resetea el campo para que seleccionar el MISMO archivo dos veces
    // seguidas (ej. tras un error de dimensiones) siga disparando
    // `onChange` -- el navegador no lo dispara de nuevo si el `value`
    // no cambio.
    e.target.value = '';
    if (file) onFileSelected(file);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <FormField label={`Importar textura (PNG ${expectedWidth}×${expectedHeight})`}>
        <input type="file" accept="image/png" aria-label="Importar textura PNG como punto de partida" onChange={handleChange} style={{ fontSize: 12 }} />
      </FormField>
      {error && <InlineError message={error} />}
    </div>
  );
}
