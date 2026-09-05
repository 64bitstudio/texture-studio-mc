import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { OverlayRect } from '../importImage';

export interface PasteImageOverlayProps {
  rect: OverlayRect;
  /**
   * Pixeles CSS RENDERIZADOS por texel, medidos contra el `<canvas>`
   * real de `TextureEditor` (no el valor logico de `zoom` de
   * `frontend/src/zoom.ts`) -- ver el porque en `Editor.tsx`
   * ("hallazgo real" del ticket 005): el `<canvas>` de `TextureEditor`
   * tiene `maxWidth: '100%'` y vive en un `<aside>` de ancho FIJO
   * (280px), asi que a zoom por defecto (1000% => 640px de ancho
   * logico) el navegador lo comprime horizontalmente sin comprimir su
   * alto -- el resultado renderizado NO es cuadrado por texel
   * (`scaleX !== scaleY`). Si el overlay usara `zoom` directo (asumiendo
   * 1:1 con el canvas), quedaria desalineado del area UV real que el
   * usuario ve en pantalla, mas cuanto mas lejos del origen (0,0).
   * Medir el escalado real del canvas (en vez de asumirlo) es la unica
   * forma de que el overlay siga alineado sin depender de arreglar esa
   * distorsion (fuera de alcance de este ticket, ver
   * docs/ARQUITECTURA.md).
   */
  scaleX: number;
  scaleY: number;
  /** Object URL de la imagen a insertar (ver contrato de ciclo de vida en `decodeTexture.ts`). */
  previewUrl: string;
  onRectChange: (rect: OverlayRect) => void;
}

/**
 * Offset (pixeles CSS) del contenido real de `TextureEditor` respecto
 * a la esquina superior izquierda de su propio `<div>` contenedor --
 * ese div tiene un borde de 1px (ver `TextureEditor.tsx`), asi que el
 * canvas de texeles arranca 1px adentro. Este overlay se renderiza
 * como HERMANO de `TextureEditor` (no dentro de el, para no quedar
 * recortado por su `overflow: hidden` mientras el overlay se arrastra
 * mas alla del borde -- ver `Editor.tsx`), asi que necesita el MISMO
 * offset para alinear sus texeles con los del canvas de abajo.
 * Acoplamiento deliberado y documentado (no medido en runtime via ref)
 * -- mismo criterio pragmatico que el offset `+0.5` ya hardcodeado en
 * el propio `TextureEditor` para las lineas de grid.
 */
const TEXTURE_EDITOR_BORDER_WIDTH = 1;

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startRect: OverlayRect;
}

/**
 * Overlay arrastrable/redimensionable de "pegar imagen" (ticket 005,
 * HU-9). Puramente de interaccion -- no conoce `TextureBuffer` ni cajas
 * UV, solo reporta el `OverlayRect` resultante via `onRectChange` (el
 * mismo patron ya establecido por `TextureEditor`: el componente de UI
 * notifica intencion, `Editor.tsx` es quien decide que hacer con ella).
 *
 * Coordenadas de texel SIEMPRE enteras (ver `OverlayRect` en
 * `importImage.ts`): el arrastre/redimension convierte el delta en
 * pixeles CSS del puntero a texeles dividiendo por `scaleX`/`scaleY` y
 * redondeando en cada evento, en vez de acumular una posicion flotante
 * -- sin perdida de fluidez percibida (el editor ya trabaja a niveles
 * de zoom de varios cientos por ciento) y sin necesidad de aritmetica
 * de rectangulos flotantes en ningun otro lugar del modulo.
 *
 * Se permite arrastrar/redimensionar LIBREMENTE, incluso mas alla de
 * los limites del buffer o cruzando de una caja UV a otra en el lienzo
 * 2D -- el recorte a la caja UV correspondiente ocurre recien al
 * confirmar (`computeBurnPixels` en `importImage.ts`), no durante la
 * interaccion (criterio explicito del ticket, HU-9).
 */
export function PasteImageOverlay({ rect, scaleX, scaleY, previewUrl, onRectChange }: PasteImageOverlayProps) {
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<DragState | null>(null);

  function handleDragPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, startRect: rect };
  }

  function handleDragPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dxTexels = Math.round((e.clientX - drag.startClientX) / scaleX);
    const dyTexels = Math.round((e.clientY - drag.startClientY) / scaleY);
    onRectChange({ ...drag.startRect, x: drag.startRect.x + dxTexels, y: drag.startRect.y + dyTexels });
  }

  function handleDragPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function handleResizePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    // Evita que el pointerdown tambien dispare `handleDragPointerDown`
    // del div contenedor (el evento burbujea) -- redimensionar y mover
    // son gestos mutuamente excluyentes en un mismo puntero.
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, startRect: rect };
  }

  function handleResizePointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    const dxTexels = Math.round((e.clientX - resize.startClientX) / scaleX);
    const dyTexels = Math.round((e.clientY - resize.startClientY) / scaleY);
    onRectChange({
      ...resize.startRect,
      width: Math.max(1, resize.startRect.width + dxTexels),
      height: Math.max(1, resize.startRect.height + dyTexels),
    });
  }

  function handleResizePointerEnd(e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <div
      role="group"
      aria-label="Imagen a insertar -- arrastra para mover"
      onPointerDown={handleDragPointerDown}
      onPointerMove={handleDragPointerMove}
      onPointerUp={handleDragPointerEnd}
      onPointerCancel={handleDragPointerEnd}
      style={{
        position: 'absolute',
        left: rect.x * scaleX + TEXTURE_EDITOR_BORDER_WIDTH,
        top: rect.y * scaleY + TEXTURE_EDITOR_BORDER_WIDTH,
        width: rect.width * scaleX,
        height: rect.height * scaleY,
        border: '2px dashed var(--accent)',
        boxSizing: 'border-box',
        cursor: 'move',
        touchAction: 'none',
      }}
    >
      <img src={previewUrl} alt="Vista previa de la imagen a insertar en la textura" draggable={false} style={{ width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none', opacity: 0.85 }} />
      <button
        type="button"
        aria-label="Redimensionar imagen a insertar"
        title="Arrastra para redimensionar"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerEnd}
        onPointerCancel={handleResizePointerEnd}
        style={{
          position: 'absolute',
          right: -8,
          bottom: -8,
          width: 16,
          height: 16,
          borderRadius: 3,
          border: '1px solid var(--accent)',
          background: 'var(--panel-bg)',
          cursor: 'nwse-resize',
          padding: 0,
          touchAction: 'none',
        }}
      />
    </div>
  );
}
