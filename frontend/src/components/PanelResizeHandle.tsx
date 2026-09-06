import { useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { PANEL_WIDTH_KEYBOARD_STEP, PANEL_WIDTH_MAX, PANEL_WIDTH_MIN, clampPanelWidth } from '../panelWidth';

export interface PanelResizeHandleProps {
  /** Ancho actual del panel lateral, en pixeles CSS. */
  panelWidth: number;
  /** Se llama en cada evento de arrastre/tecla -- actualiza el ancho visualmente en vivo. */
  onPanelWidthChange: (width: number) => void;
  /** Se llama cuando el gesto termina (pointerup/pointercancel) o tras cada ajuste por teclado -- momento de persistir en `localStorage`. */
  onPanelWidthCommit: (width: number) => void;
}

interface DragState {
  pointerId: number;
  startClientX: number;
  startWidth: number;
}

/**
 * Handle arrastrable entre el visor 3D y el `<aside>` del panel
 * lateral (ticket 010). Mismo patron de arrastre ya establecido por
 * `PasteImageOverlay.tsx` (ticket 005): `setPointerCapture` en
 * `pointerdown`, delta de `clientX` contra un punto de inicio guardado
 * en un `ref`, sin acumular una posicion flotante propia.
 *
 * El panel esta a la DERECHA de este handle -- arrastrar hacia la
 * IZQUIERDA (clientX decreciente) debe ENSANCHAR el panel (el visor 3D
 * cede espacio), y viceversa. Por eso `deltaX = startClientX -
 * clientX` (invertido respecto a un arrastre que "sigue" al cursor).
 *
 * Accesible como `role="separator"` (patron ARIA para un divisor
 * redimensionable) con soporte de teclado (flechas izquierda/derecha,
 * Home/End) para quien no puede arrastrar con el mouse -- el propio
 * elemento no tiene texto visible, de ahi el `aria-label` (regla de
 * accesibilidad del equipo para controles solo-icono/sin texto).
 */
export function PanelResizeHandle({ panelWidth, onPanelWidthChange, onPanelWidthCommit }: PanelResizeHandleProps) {
  const dragRef = useRef<DragState | null>(null);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startClientX: e.clientX, startWidth: panelWidth };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const deltaX = drag.startClientX - e.clientX;
    onPanelWidthChange(clampPanelWidth(drag.startWidth + deltaX));
  }

  function handlePointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    const wasDragging = dragRef.current?.pointerId === e.pointerId;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    // Persistir solo al terminar el gesto (no en cada pointermove) --
    // evita decenas de escrituras a localStorage por segundo durante un
    // arrastre continuo, sin perder la persistencia del valor final.
    if (wasDragging) onPanelWidthCommit(panelWidth);
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = panelWidth + PANEL_WIDTH_KEYBOARD_STEP;
    else if (e.key === 'ArrowRight') next = panelWidth - PANEL_WIDTH_KEYBOARD_STEP;
    else if (e.key === 'Home') next = PANEL_WIDTH_MIN;
    else if (e.key === 'End') next = PANEL_WIDTH_MAX;
    if (next === null) return;
    e.preventDefault();
    const clamped = clampPanelWidth(next);
    onPanelWidthChange(clamped);
    onPanelWidthCommit(clamped);
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Ajustar ancho del panel lateral"
      aria-valuenow={Math.round(panelWidth)}
      aria-valuemin={PANEL_WIDTH_MIN}
      aria-valuemax={PANEL_WIDTH_MAX}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
      style={handleStyle}
    >
      <div style={handleLineStyle} />
    </div>
  );
}

const handleStyle: CSSProperties = {
  width: 9,
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'center',
  cursor: 'col-resize',
  touchAction: 'none',
  background: 'transparent',
};

const handleLineStyle: CSSProperties = {
  width: 1,
  height: '100%',
  background: 'rgba(255,255,255,0.15)',
};
