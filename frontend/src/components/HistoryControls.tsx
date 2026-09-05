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
 */
export function HistoryControls({ canUndo, canRedo, onUndo, onRedo }: HistoryControlsProps) {
  return (
    <div role="group" aria-label="Deshacer y rehacer" style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Deshacer (Ctrl/Cmd+Z)"
        style={{
          flex: 1,
          padding: '8px 10px',
          fontSize: 13,
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.25)',
          background: 'var(--panel-bg)',
          color: 'var(--text)',
          cursor: canUndo ? 'pointer' : 'not-allowed',
          opacity: canUndo ? 1 : 0.5,
        }}
      >
        Deshacer
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        title="Rehacer (Ctrl/Cmd+Shift+Z o Ctrl+Y)"
        style={{
          flex: 1,
          padding: '8px 10px',
          fontSize: 13,
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.25)',
          background: 'var(--panel-bg)',
          color: 'var(--text)',
          cursor: canRedo ? 'pointer' : 'not-allowed',
          opacity: canRedo ? 1 : 0.5,
        }}
      >
        Rehacer
      </button>
    </div>
  );
}
