import type { ChangeEvent } from 'react';

export interface ImportTextureControlProps {
  expectedWidth: number;
  expectedHeight: number;
  error: string | null;
  onFileSelected: (file: File) => void;
}

/**
 * Control de UI para importar un PNG existente como punto de partida
 * (ticket 005, HU-8). Decision de este ticket entre "input de archivo o
 * zona de drag&drop": se eligio un campo de archivo simple (type=file,
 * envuelto en un `<label>` con texto visible, mismo patron ya usado por
 * `ColorPicker` para su selector libre) -- no una zona de drag&drop.
 * Motivo: el resto de la UI del editor ya son controles de formulario
 * simples (checkboxes, botones, selectores nativos), y un drag&drop
 * hubiera introducido un segundo patron de interaccion sin un
 * requisito explicito que lo pidiera especificamente (HU-8 solo pide
 * "subir un PNG"). El mensaje de error (dimensiones incorrectas u otro
 * fallo de lectura) se muestra inline con `role="alert"`, mismo estilo
 * que el `initError` de `Editor.tsx` -- nunca un aviso nativo del
 * navegador (criterio explicito del ticket).
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
    <div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Importar textura (PNG {expectedWidth}×{expectedHeight})
        <input type="file" accept="image/png" aria-label="Importar textura PNG como punto de partida" onChange={handleChange} style={{ fontSize: 12 }} />
      </label>
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
