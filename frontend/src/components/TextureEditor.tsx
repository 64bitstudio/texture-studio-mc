import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { hexToRgba } from '../colors';
import type { PixelPoint, RGBA, TextureBuffer } from '../textureBuffer';
import { ZOOM_STEP, clampZoom } from '../zoom';

export interface TextureEditorProps {
  buffer: TextureBuffer;
  /** Se incrementa en cada escritura al buffer -- dispara el redibujado del canvas. */
  version: number;
  /** Color actualmente seleccionado, como `#rrggbb` (ver `ColorPicker`). */
  color: string;
  /** Pixeles CSS por texel (ticket 004, HU-7). Ver `ZoomControls`/`frontend/src/zoom.ts`. */
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /** Muestra/oculta las lineas de cuadricula entre texeles (ticket 004). */
  showGrid: boolean;
  onSetPixel: (x: number, y: number, color: RGBA) => void;
  onPaintLine: (from: PixelPoint, to: PixelPoint, color: RGBA) => void;
  /** Marca el inicio de un trazo (pointerdown) -- unidad de historial de undo/redo (ticket 003). */
  onStrokeStart: () => void;
  /** Marca el fin de un trazo (pointerup/pointercancel) -- ticket 003. */
  onStrokeEnd: () => void;
}

/** Color de las lineas de cuadricula sobre el canvas de textura -- sutil, no compite con los colores pintados. */
const GRID_LINE_COLOR = 'rgba(0, 0, 0, 0.3)';

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
 *
 * Ticket 004 (HU-7): el factor de escala (`zoom`) ya no es la
 * constante fija `DISPLAY_SCALE` del ticket 002 -- es una prop
 * controlada por `Editor.tsx`, ajustable con `ZoomControls` (botones
 * +/-) o con Ctrl/Cmd + rueda del mouse sobre este mismo canvas (ver
 * `handleWheel`). El backing store del canvas principal sigue siendo
 * exactamente `buffer.width x buffer.height` (resolucion nativa de la
 * textura) en cualquier nivel de zoom -- solo cambia el `style.width`/
 * `style.height` (CSS) que lo escala, con `image-rendering: pixelated`
 * siempre activo -- por eso el zoom nunca introduce blur/interpolacion,
 * sin importar el factor.
 *
 * La cuadricula de pixeles (criterio "grid ajustable") se dibuja en un
 * SEGUNDO `<canvas>` superpuesto (`gridCanvasRef`), no en el mismo
 * canvas que la textura: el canvas de textura tiene backing store de
 * 64x32 (un pixel de canvas == un texel), asi que no hay espacio
 * "entre" pixeles donde trazar una linea sin corromper el color real
 * del texel. El canvas de grid, en cambio, tiene backing store igual a
 * la resolucion de PRESENTACION (`buffer.width*zoom x
 * buffer.height*zoom`) y dibuja lineas de 1px en cada limite de texel
 * -- se recalcula solo cuando cambia `zoom`/tamaño del buffer/
 * visibilidad, no en cada pixel pintado (`version` no esta en sus
 * dependencias). Tiene `pointer-events: none` y `aria-hidden` -- es
 * puramente decorativo, todos los eventos de puntero siguen llegando
 * al canvas de textura de abajo.
 */
export function TextureEditor({
  buffer,
  version,
  color,
  zoom,
  onZoomChange,
  showGrid,
  onSetPixel,
  onPaintLine,
  onStrokeStart,
  onStrokeEnd,
}: TextureEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

  const displayWidth = buffer.width * zoom;
  const displayHeight = buffer.height * zoom;

  useEffect(() => {
    if (!showGrid) return;
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    // +0.5 centra cada linea de 1px exactamente en un limite de texel
    // (evita el "medio pixel" borroso tipico de trazar lineas de ancho
    // impar sobre coordenadas enteras en un canvas 2D).
    for (let x = 0; x <= buffer.width; x++) {
      const px = x * zoom + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, displayHeight);
    }
    for (let y = 0; y <= buffer.height; y++) {
      const py = y * zoom + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(displayWidth, py);
    }
    ctx.stroke();
  }, [showGrid, zoom, buffer.width, buffer.height, displayWidth, displayHeight]);

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
    onStrokeStart();
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
    const wasPainting = isPaintingRef.current;
    isPaintingRef.current = false;
    lastCellRef.current = null;
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    // Solo cierra un trazo si realmente habia uno en curso -- evita un
    // `commitStroke` espurio ante un pointerup/pointercancel sin
    // pointerdown previo (PaintHistory ya es defensivo ante esto, pero
    // no hace falta ni siquiera llamarlo).
    if (wasPainting) onStrokeEnd();
  }

  /**
   * Zoom con Ctrl/Cmd + rueda del mouse (ticket 004, HU-7 -- eleccion
   * de este ticket entre "botones y/o rueda"). Requiere el modificador
   * para no competir con el scroll normal de la pagina/panel lateral
   * cuando el cursor esta sobre el editor de textura. `preventDefault`
   * evita ademas el zoom nativo de la pagina del navegador que Ctrl+
   * rueda dispara por default en la mayoria de navegadores.
   */
  function handleWheel(e: ReactWheelEvent<HTMLCanvasElement>) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    onZoomChange(clampZoom(zoom + direction * ZOOM_STEP));
  }

  return (
    // El borde vive en el div contenedor, no en el `<canvas>` de
    // textura: si el borde estuviera en el canvas, su "content box"
    // (donde se dibujan los pixeles) quedaria desplazado 1px respecto
    // al canvas de grid superpuesto (que no tiene borde propio),
    // desalineando las lineas de cuadricula respecto a los texeles
    // reales.
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        maxWidth: '100%',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        width={buffer.width}
        height={buffer.height}
        aria-label={`Editor de textura pixel a pixel, cuadricula de ${buffer.width} por ${buffer.height} pixeles`}
        style={{
          width: displayWidth,
          height: displayHeight,
          imageRendering: 'pixelated',
          touchAction: 'none',
          cursor: 'crosshair',
          display: 'block',
          maxWidth: '100%',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPainting}
        onPointerCancel={stopPainting}
        onWheel={handleWheel}
      />
      {showGrid && (
        <canvas
          ref={gridCanvasRef}
          width={displayWidth}
          height={displayHeight}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: displayWidth,
            height: displayHeight,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
