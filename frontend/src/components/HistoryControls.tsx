import { Button } from '../ui';

export interface HistoryControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * Botones "Deshacer"/"Rehacer" (ticket 003, HU-4). Deshabilitados
 * cuando no hay nada que deshacer/rehacer respectivamente (`canUndo`/
 * `canRedo` vienen de `PaintHistory`, ver `history.ts`). Los atajos de
 * teclado equivalentes (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y) se
 * manejan a nivel de pagina en `Editor.tsx`, no aqui -- este componente
 * es solo la superficie de UI.
 *
 * Ticket 025: primer consumidor real de `Button` (`frontend/src/ui/`) --
 * ejemplo mínimo de verificación pedido por el ticket, antes de migrar
 * el resto de los ~15 controles del panel en el ticket 026.
 *
 * Ticket 032 (HU-7): ícono junto al texto (nunca solo ícono -- el texto
 * visible sigue siendo el nombre accesible real, el glifo es `aria-hidden`).
 */
export function HistoryControls({ canUndo, canRedo, onUndo, onRedo }: HistoryControlsProps) {
  return (
    <div role="group" aria-label="Deshacer y rehacer" style={{ display: 'flex', gap: 8 }}>
      <Button onClick={onUndo} disabled={!canUndo} title="Deshacer (Ctrl/Cmd+Z)" style={{ flex: 1, justifyContent: 'center' }}>
        <span aria-hidden="true">↶</span>
        Deshacer
      </Button>
      <Button onClick={onRedo} disabled={!canRedo} title="Rehacer (Ctrl/Cmd+Shift+Z o Ctrl+Y)" style={{ flex: 1, justifyContent: 'center' }}>
        <span aria-hidden="true">↷</span>
        Rehacer
      </Button>
    </div>
  );
}
