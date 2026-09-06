import type { ChangeEvent } from 'react';
import { Button, FormField, InlineError } from '../ui';

export interface PasteImageControlsProps {
  hasPending: boolean;
  error: string | null;
  onFileSelected: (file: File) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Controles de "pegar/insertar imagen" (ticket 005, HU-9). El evento
 * `paste` del portapapeles se maneja a nivel de `window` en
 * `Editor.tsx` -- este componente cubre la ALTERNATIVA explícita del
 * ticket ("o subirla vía archivo") más los botones "Confirmar"/
 * "Cancelar" del overlay arrastrable/redimensionable (ver
 * `components/PasteImageOverlay.tsx`).
 *
 * Ticket 026: migrado a `FormField`+`Button`+`InlineError` (`ui/`).
 */
export function PasteImageControls({ hasPending, error, onFileSelected, onConfirm, onCancel }: PasteImageControlsProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFileSelected(file);
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <FormField label="Insertar imagen (arrastrable) o pegar con Ctrl/Cmd+V">
        <input type="file" accept="image/*" aria-label="Insertar imagen para encajar en una region UV" onChange={handleChange} style={{ fontSize: 12 }} />
      </FormField>

      {hasPending && (
        <div role="group" aria-label="Confirmar o descartar la imagen a insertar" style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" onClick={onConfirm} style={{ flex: 1, justifyContent: 'center' }}>
            Confirmar
          </Button>
          <Button onClick={onCancel} style={{ flex: 1, justifyContent: 'center' }}>
            Cancelar
          </Button>
        </div>
      )}

      {hasPending && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>
          Arrastra la imagen para moverla, usa la esquina para redimensionarla.
        </p>
      )}

      {error && <InlineError message={error} />}
    </div>
  );
}
