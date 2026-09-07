import { forwardRef, type ChangeEvent } from 'react';

export interface ImportTextureControlProps {
  expectedWidth: number;
  expectedHeight: number;
  onFileSelected: (file: File) => void;
}

/**
 * Control de "importar un PNG existente como punto de partida" (ticket
 * 005, HU-8). Es SOLO el input de archivo, oculto -- pedido de Marco
 * (revisión en vivo del ticket 072): un click en "Importar" (el botón
 * visible de la barra de herramientas, `Editor.tsx`) debe abrir el
 * explorador de archivos DIRECTAMENTE, sin un paso intermedio de menú/
 * formulario. Antes de este cambio este componente renderizaba su
 * propio input de archivo visible dentro de un `FormField` -- ahora ese
 * input vive oculto (`display: none`) y se dispara con
 * `ref.current.click()` desde el botón visible (`forwardRef` para
 * exponer el nodo del input sin que `Editor.tsx` tenga que conocer su
 * implementación).
 *
 * `error` (antes mostrado inline aca via `InlineError`) se retira de
 * este componente -- `Editor.tsx` lo muestra en una fila compartida
 * bajo la barra de herramientas (mismo criterio que `pasteError`).
 *
 * Ticket 026: migrado a `FormField`+`InlineError` (`ui/`) -- retirado
 * en este cambio, ver arriba. El input va en una sola línea -- ver
 * gotcha ya documentado del hook de accesibilidad con tags multilínea.
 */
export const ImportTextureControl = forwardRef<HTMLInputElement, ImportTextureControlProps>(function ImportTextureControl(
  { expectedWidth, expectedHeight, onFileSelected },
  ref,
) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Resetea el campo para que seleccionar el MISMO archivo dos veces
    // seguidas (ej. tras un error de dimensiones) siga disparando
    // `onChange` -- el navegador no lo dispara de nuevo si el `value`
    // no cambio.
    e.target.value = '';
    if (file) onFileSelected(file);
  }

  const label = `Importar textura PNG (${expectedWidth}×${expectedHeight}) como punto de partida`;

  return <input ref={ref} type="file" accept="image/png" aria-label={label} onChange={handleChange} style={{ display: 'none' }} />;
});
