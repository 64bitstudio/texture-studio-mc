export interface LoadingOverlayProps {
  /** Mensaje visible + anunciado a lectores de pantalla (`role="status"`/`aria-live="polite"`). */
  message: string;
}

/**
 * Overlay de carga (ticket 025, usado por el ticket 033 -- carga
 * inicial, cambio de mob, carga de proyecto guardado). `position:
 * absolute` sobre `inset: 0` -- el contenedor que lo use debe tener
 * `position: relative` para que se recorte a su propia área, no a toda
 * la ventana (ej. el área del editor al cambiar de mob, no la pantalla
 * completa).
 */
export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="ui-loading-overlay" role="status" aria-live="polite">
      <div className="ui-spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
