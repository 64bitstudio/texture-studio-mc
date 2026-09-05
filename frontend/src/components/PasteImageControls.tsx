import type { ChangeEvent } from 'react';

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
 * `Editor.tsx` (mismo patron que los atajos de Ctrl/Cmd+Z del ticket
 * 003) -- no hay UI propia para eso aca. Este componente cubre la
 * ALTERNATIVA explicita del ticket ("o subirla via archivo") con un
 * campo de tipo archivo, mas los botones "Confirmar"/"Cancelar" del
 * overlay arrastrable/redimensionable (ver
 * `components/PasteImageOverlay.tsx`), habilitados solo mientras hay
 * una imagen pendiente. Acepta cualquier imagen (no solo PNG, a
 * diferencia de `ImportTextureControl` de HU-8) porque HU-9 no fija un
 * formato -- puede ser cualquier tamaño/proporcion.
 */
export function PasteImageControls({ hasPending, error, onFileSelected, onConfirm, onCancel }: PasteImageControlsProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFileSelected(file);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Insertar imagen (arrastrable) o pegar con Ctrl/Cmd+V
        <input type="file" accept="image/*" aria-label="Insertar imagen para encajar en una region UV" onChange={handleChange} style={{ fontSize: 12 }} />
      </label>

      {hasPending && (
        <div role="group" aria-label="Confirmar o descartar la imagen a insertar" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '8px 10px',
              fontSize: 13,
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'var(--accent)',
              color: '#1b1c22',
              cursor: 'pointer',
            }}
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '8px 10px',
              fontSize: 13,
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'var(--panel-bg)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      {hasPending && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>
          Arrastra la imagen para moverla, usa la esquina para redimensionarla.
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{
            margin: '6px 0 0',
            padding: '6px 8px',
            fontSize: 12,
            color: 'var(--text)',
            background: 'rgba(200, 60, 60, 0.25)',
            borderRadius: 4,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
