import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { hexToRgba } from '../colors';
import type { PixelPoint, RGBA, TextureBuffer } from '../textureBuffer';

/**
 * Escala fija de visualizacion (64x32 -> 640x320). Zoom ajustable es
 * alcance del ticket 004 -- aqui basta un tamaño visible razonable, sin
 * controles de zoom.
 */
const DISPLAY_SCALE = 10;

export interface TextureEditorProps {
  buffer: TextureBuffer;
  /** Se incrementa en cada escritura al buffer -- dispara el redibujado del canvas. */
  version: number;
  /** Color actualmente seleccionado, como `#rrggbb` (ver `ColorPicker`). */
  color: string;
  onSetPixel: (x: number, y: number, color: RGBA) => void;
  onPaintLine: (from: PixelPoint, to: PixelPoint, color: RGBA) => void;
}

/**
 * Editor de textura pixel a pixel (HU-2): `<canvas>` 2D que renderiza
 * la cuadricula 64x32 del `TextureBuffer` escalada sin interpolacion
 * (`image-rendering: pixelated`, equivalente CSS a
 * `imageSmoothingEnabled = false` para el escalado de presentacion --
 * `imageSmoothingEnabled` tambien se fija en el contexto por
 * completitud, aunque `putImageData` no lo necesita). Click pinta un
 * pixel; mantener presionado y arrastrar pinta en modo brocha,
 * interpolando la linea entre el evento anterior y el actual
 * (`TextureBuffer.paintLine`) para no saltarse celdas con movimientos
 * rapidos del cursor.
 */
export function TextureEditor({ buffer, version, color, onSetPixel, onPaintLine }: TextureEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPaintingRef = useRef(false);
  const lastCellRef = useRef<PixelPoint | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(buffer.toImageData(), 0, 0);
  }, [buffer, version]);

  function cellFromEvent(e: ReactPointerEvent<HTMLCanvasElement>): PixelPoint | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    return { x, y };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const cell = cellFromEvent(e);
    if (!cell) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isPaintingRef.current = true;
    lastCellRef.current = cell;
    onSetPixel(cell.x, cell.y, hexToRgba(color));
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isPaintingRef.current) return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    const last = lastCellRef.current;
    if (last && last.x === cell.x && last.y === cell.y) return;

    if (last) {
      onPaintLine(last, cell, hexToRgba(color));
    } else {
      onSetPixel(cell.x, cell.y, hexToRgba(color));
    }
    lastCellRef.current = cell;
  }

  function stopPainting(e: ReactPointerEvent<HTMLCanvasElement>) {
    isPaintingRef.current = false;
    lastCellRef.current = null;
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={buffer.width}
      height={buffer.height}
      aria-label={`Editor de textura pixel a pixel, cuadricula de ${buffer.width} por ${buffer.height} pixeles`}
      style={{
        width: buffer.width * DISPLAY_SCALE,
        height: buffer.height * DISPLAY_SCALE,
        imageRendering: 'pixelated',
        touchAction: 'none',
        cursor: 'crosshair',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 4,
        display: 'block',
        maxWidth: '100%',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopPainting}
      onPointerCancel={stopPainting}
    />
  );
}
