import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { hexToRgba } from '../colors';
import { computeCanvasDisplaySize } from '../canvasSize';
import { isPixelInActiveRegion } from '../partIsolation';
import type { NamedUVRegion } from '../regionLabels';
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
  /**
   * Catalogo de regiones UV nombradas (ticket 011), ya escalado a la
   * resolucion de trabajo activa -- ver `regionLabels.ts`. Se usa para
   * dibujar el overlay de fronteras entre regiones (lineas mas
   * marcadas que la cuadricula normal, siempre visible -- ver
   * docs/ARQUITECTURA.md, "Ticket 011", decision de no agregar un
   * toggle dedicado). Opcional para no romper ningun consumidor/test
   * futuro que no necesite el overlay.
   */
  namedRegions?: NamedUVRegion[];
  /** Notifica que celda esta bajo el cursor (o `null` al salir del canvas) -- ticket 011, etiqueta de region en el panel. */
  onHoverPixel?: (point: PixelPoint | null) => void;
  /**
   * Parte actualmente aislada (ticket 012), o `null`/`undefined` en modo
   * "Mostrar todo". Cuando esta presente:
   * - Se dibuja un overlay que atenua (oscurece) todo lo que NO
   *   pertenece a esta region (ver `isolationCanvasRef` mas abajo).
   * - El cursor cambia a `not-allowed` sobre el area atenuada (feedback
   *   inmediato de que pintar ahi no tendra efecto -- el bloqueo real de
   *   la escritura ocurre en `Editor.tsx`, este componente solo da la
   *   señal visual).
   */
  isolatedRegion?: NamedUVRegion | null;
}

/**
 * Color del overlay de atenuado del ticket 012 (aislar parte para
 * pintar). Se dibuja en un canvas separado (mismo patron que el grid/
 * fronteras) que cubre TODO el area de presentacion salvo un "agujero"
 * (`clearRect`) exactamente sobre el rectangulo de la parte aislada --
 * asi el resto de la cuadricula queda visualmente diferenciado como
 * no-editable sin tocar ni un pixel del `TextureBuffer` real (la
 * atenuacion es puramente de presentacion, ver docs/ARQUITECTURA.md,
 * "Ticket 012").
 */
const ISOLATION_DIM_COLOR = 'rgba(0, 0, 0, 0.7)';

/** Color de las lineas de cuadricula sobre el canvas de textura -- sutil, no compite con los colores pintados. */
const GRID_LINE_COLOR = 'rgba(0, 0, 0, 0.3)';

/**
 * Color/grosor del overlay de fronteras entre regiones UV nombradas
 * (ticket 011) -- deliberadamente mas marcado que `GRID_LINE_COLOR`
 * (mayor opacidad + 2px en vez de 1px) para que sea distinguible de la
 * cuadricula normal de texeles sin necesidad de hover, tal como pide el
 * criterio de aceptacion del ticket.
 */
const REGION_BORDER_COLOR = 'rgba(255, 214, 89, 0.85)';

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
 *
 * **Ticket 010 -- ya NO usa `maxWidth: '100%'` en el canvas.** Antes
 * de este ticket, el `<canvas>` tenia `style.maxWidth: '100%'` ademas
 * de `style.width/height` fijos -- dentro de un `<aside>` de ancho
 * FIJO, cuando el ancho logico (`displayWidth`) excedia el ancho
 * disponible, el navegador comprimia SOLO el ancho renderizado (sin
 * `height: auto`), produciendo texeles no cuadrados (hallazgo
 * documentado en `docs/ARQUITECTURA.md`, tickets 005/008). El `<aside>`
 * era ajustable por el usuario en ese momento (`PanelResizeHandle`,
 * eliminado en el ticket 029 -- el panel ahora es de ancho flexible por
 * el layout en grid, ver `docs/ARQUITECTURA.md` "Ticket 029") -- sin
 * importar el ancho real del panel, el canvas SIEMPRE se renderiza a
 * `computeCanvasDisplaySize(buffer.width, buffer.height, zoom)` --
 * mismo factor de escala en ambos ejes, sin importar el ancho
 * disponible. Si no cabe, el CONTENEDOR (el wrapper en `Editor.tsx`)
 * scrollea horizontalmente (`overflow-x: auto`) en vez de comprimir el
 * canvas.
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
  namedRegions,
  onHoverPixel,
  isolatedRegion,
}: TextureEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isolationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const regionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPaintingRef = useRef(false);
  const lastCellRef = useRef<PixelPoint | null>(null);
  // Cursor `not-allowed` sobre el area atenuada (ticket 012) -- estado
  // separado (no derivado en cada render) porque solo debe cambiar
  // cuando el cursor CRUZA la frontera dentro/fuera de la parte
  // aislada, no en cada `pointermove` dentro de la misma zona.
  const [cursorBlocked, setCursorBlocked] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(buffer.toImageData(), 0, 0);
  }, [buffer, version]);

  const { width: displayWidth, height: displayHeight } = computeCanvasDisplaySize(buffer.width, buffer.height, zoom);

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

  /**
   * Overlay de fronteras entre regiones UV nombradas (ticket 011).
   * Mismo patron que el canvas de grid de arriba (segundo `<canvas>`
   * superpuesto, backing store = resolucion de PRESENTACION, para poder
   * trazar lineas sin corromper el color real de los texeles) -- pero
   * SIEMPRE visible (no depende de `showGrid`, criterio de este ticket:
   * las fronteras entre regiones deben ser "visualmente claras" sin
   * necesidad de hover ni de activar nada, ver docs/ARQUITECTURA.md).
   * Dibuja el borde de cada rectangulo de `namedRegions` -- como
   * regiones adyacentes comparten aristas, el resultado es exactamente
   * la cuadricula de fronteras entre TODAS las caras de TODAS las
   * cajas, mas marcada que la cuadricula de texeles normal.
   */
  useEffect(() => {
    const canvas = regionCanvasRef.current;
    if (!canvas || !namedRegions) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = REGION_BORDER_COLOR;
    ctx.lineWidth = 2;
    for (const region of namedRegions) {
      const { x0, y0, x1, y1 } = region.rect;
      // +0.5/-0.5 (via lineWidth par) alinea el trazo con el limite de
      // texel, mismo criterio que el canvas de grid -- lineWidth=2 en
      // vez de 1 es justamente lo que lo hace "mas marcado".
      ctx.strokeRect(x0 * zoom, y0 * zoom, (x1 - x0) * zoom, (y1 - y0) * zoom);
    }
  }, [namedRegions, zoom, displayWidth, displayHeight]);

  /**
   * Overlay de atenuado de la parte aislada (ticket 012). Mismo patron
   * que los canvas de grid/fronteras de arriba -- backing store =
   * resolucion de PRESENTACION, `pointer-events: none`. Se dibuja DESPUES
   * del canvas de grid pero ANTES del de fronteras en el JSX (ver mas
   * abajo) para que las lineas amarillas de fronteras (ticket 011) sigan
   * visibles incluso sobre el area oscurecida -- ayuda a orientarse
   * dentro de la zona atenuada.
   */
  useEffect(() => {
    const canvas = isolationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!isolatedRegion) return;

    ctx.fillStyle = ISOLATION_DIM_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const { x0, y0, x1, y1 } = isolatedRegion.rect;
    ctx.clearRect(x0 * zoom, y0 * zoom, (x1 - x0) * zoom, (y1 - y0) * zoom);
  }, [isolatedRegion, zoom, displayWidth, displayHeight]);

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
    const cell = cellFromEvent(e);
    // Etiqueta de region bajo el cursor (ticket 011) -- independiente de
    // si se esta pintando o no, por eso vive fuera del `if
    // (!isPaintingRef.current) return` de abajo.
    onHoverPixel?.(cell);

    // Cursor `not-allowed` fuera de la parte aislada (ticket 012) --
    // misma funcion pura que usa `Editor.tsx` para bloquear la
    // escritura real, reusada aca solo para la señal visual del cursor.
    const blocked = !!isolatedRegion && (!cell || !isPixelInActiveRegion(cell, isolatedRegion));
    setCursorBlocked((prev) => (prev === blocked ? prev : blocked));

    if (!isPaintingRef.current) return;
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

  /** Limpia la etiqueta de region al salir del canvas (ticket 011) -- no interfiere con el pintado (`stopPainting` sigue atado a pointerup/pointercancel). */
  function handlePointerLeave() {
    onHoverPixel?.(null);
    setCursorBlocked(false);
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
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        width={buffer.width}
        height={buffer.height}
        aria-label={
          isolatedRegion
            ? `Editor de textura pixel a pixel, cuadricula de ${buffer.width} por ${buffer.height} pixeles. Parte aislada: ${isolatedRegion.label}. El resto de la cuadricula esta bloqueado para pintar.`
            : `Editor de textura pixel a pixel, cuadricula de ${buffer.width} por ${buffer.height} pixeles`
        }
        style={{
          width: displayWidth,
          height: displayHeight,
          imageRendering: 'pixelated',
          touchAction: 'none',
          cursor: cursorBlocked ? 'not-allowed' : 'crosshair',
          display: 'block',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPainting}
        onPointerCancel={stopPainting}
        onPointerLeave={handlePointerLeave}
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
      {isolatedRegion && (
        <canvas
          ref={isolationCanvasRef}
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
      {namedRegions && (
        <canvas
          ref={regionCanvasRef}
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
