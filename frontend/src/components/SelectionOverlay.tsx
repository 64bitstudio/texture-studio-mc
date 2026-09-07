import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { OverlayRect } from '../importImage';
import { IconCopy, IconScissors, IconX } from '../ui/icons';

export interface SelectionOverlayProps {
  /**
   * `null` mientras todavia no hay ningun rectangulo dibujado -- en ese
   * estado el overlay COMPLETO actua como lienzo de "marquee": arrastrar
   * dibuja el rectangulo (fase 1). Una vez que `Editor.tsx` reporta un
   * rect vigente via `onRectCreated`, este mismo componente pasa a la
   * fase 2 (ajustable: arrastrar el cuerpo mueve, la esquina
   * redimensiona) con los botones Copiar/Cortar/Cancelar flotando sobre
   * el rectangulo -- mismo patron visual que `PasteImageOverlay.tsx`
   * (arrastre/redimension + botones circulares en la esquina superior
   * derecha), pero AMBAS fases viven aca (a diferencia de "pegar
   * imagen", donde la fase 1 -- decodificar el archivo -- vive en
   * `Editor.tsx` porque no es interaccion de puntero; aca la fase 1
   * tambien es pura interaccion de puntero sobre el lienzo).
   */
  rect: OverlayRect | null;
  /**
   * Limites del buffer activo (texeles). A diferencia de "pegar imagen"
   * (que permite arrastrar una imagen EXTERNA mas alla del borde del
   * canvas, recortandose recien al confirmar sobre la caja UV objetivo,
   * ver `computeBurnPixels`), una seleccion representa SIEMPRE pixeles
   * reales del buffer -- se recorta a estos limites en todo momento,
   * tanto al dibujarla como al ajustarla despues, nunca solo al final.
   */
  bufferWidth: number;
  bufferHeight: number;
  /** Pixeles CSS renderizados por texel -- ver el mismo prop en `PasteImageOverlay.tsx` para el porque de medirlo en vez de asumir `zoom` directo. */
  scaleX: number;
  scaleY: number;
  /** Se dispara UNA vez, al soltar el puntero tras dibujar el rectangulo inicial (fin de la fase 1). */
  onRectCreated: (rect: OverlayRect) => void;
  /** Se dispara en cada paso de mover/redimensionar el rectangulo ya existente (fase 2) -- mismo patron que `onRectChange` de `PasteImageOverlay.tsx`. */
  onRectChange: (rect: OverlayRect) => void;
  onCopy: () => void;
  onCut: () => void;
  onCancel: () => void;
}

/**
 * Ver el mismo valor/comentario en `PasteImageOverlay.tsx` -- este
 * componente vive como hermano de `TextureEditor` dentro del mismo
 * wrapper (`textureCanvasWrapperRef` en `Editor.tsx`), asi que necesita
 * el mismo offset del borde de 1px para alinear sus texeles con los del
 * canvas de abajo.
 */
const TEXTURE_EDITOR_BORDER_WIDTH = 1;

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startRect: OverlayRect;
}

interface DrawState {
  pointerId: number;
  startX: number;
  startY: number;
}

/** Recorta `rect` a `[0,bufferWidth) x [0,bufferHeight)`, garantizando ancho/alto >= 1 -- una seleccion nunca queda vacia ni fuera de la textura real (ver el prop `bufferWidth`/`bufferHeight` de arriba). */
function clampToBuffer(rect: OverlayRect, bufferWidth: number, bufferHeight: number): OverlayRect {
  const x0 = Math.max(0, Math.min(rect.x, bufferWidth - 1));
  const y0 = Math.max(0, Math.min(rect.y, bufferHeight - 1));
  const x1 = Math.max(x0 + 1, Math.min(rect.x + rect.width, bufferWidth));
  const y1 = Math.max(y0 + 1, Math.min(rect.y + rect.height, bufferHeight));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Herramienta "Seleccionar" (HU de Seleccionar + Copiar/Cortar): overlay
 * arrastrable/redimensionable de seleccion rectangular sobre la
 * textura, con acciones Copiar/Cortar/Cancelar. Puramente de
 * interaccion -- no conoce `TextureBuffer` ni el portapapeles interno,
 * solo reporta el `OverlayRect` resultante y las 3 acciones via props
 * (mismo patron ya establecido por `PasteImageOverlay.tsx`: el
 * componente de UI notifica intencion, `Editor.tsx` decide que hacer
 * con ella -- extraer los pixeles, limpiarlos a transparente, etc.).
 */
export function SelectionOverlay({
  rect,
  bufferWidth,
  bufferHeight,
  scaleX,
  scaleY,
  onRectCreated,
  onRectChange,
  onCopy,
  onCut,
  onCancel,
}: SelectionOverlayProps) {
  const drawRef = useRef<DrawState | null>(null);
  const [draftRect, setDraftRect] = useState<OverlayRect | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<DragState | null>(null);

  /** Convierte un evento de puntero a coordenadas de texel, relativas al CONTENIDO del canvas (ya descontado el borde de 1px) -- usado solo en la fase 1 (dibujar), donde no hay un `rect` previo del que partir por delta. */
  function texelFromEvent(e: ReactPointerEvent<HTMLDivElement>): { x: number; y: number } {
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - bounds.left - TEXTURE_EDITOR_BORDER_WIDTH) / scaleX);
    const y = Math.round((e.clientY - bounds.top - TEXTURE_EDITOR_BORDER_WIDTH) / scaleY);
    return { x, y };
  }

  // Fase 1 -- dibujar un rectangulo nuevo (rect === null): el overlay
  // entero (inset:0 sobre el canvas, ver el return mas abajo) actua de
  // lienzo. `draftRect` es estado LOCAL (nunca sube a `Editor.tsx` hasta
  // soltar el puntero) -- mismo criterio que el resto del editor: solo
  // el resultado final de un gesto es lo que le importa al estado de
  // React de arriba, no cada frame intermedio del arrastre.
  function handleDrawPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = texelFromEvent(e);
    drawRef.current = { pointerId: e.pointerId, startX: x, startY: y };
    setDraftRect(clampToBuffer({ x, y, width: 1, height: 1 }, bufferWidth, bufferHeight));
  }

  function handleDrawPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const draw = drawRef.current;
    if (!draw || draw.pointerId !== e.pointerId) return;
    const { x, y } = texelFromEvent(e);
    const x0 = Math.min(draw.startX, x);
    const y0 = Math.min(draw.startY, y);
    const x1 = Math.max(draw.startX, x) + 1;
    const y1 = Math.max(draw.startY, y) + 1;
    setDraftRect(clampToBuffer({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, bufferWidth, bufferHeight));
  }

  function handleDrawPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drawRef.current = null;
    const finalRect = draftRect;
    setDraftRect(null);
    // Un click sin arrastre real igual produce un rectangulo valido de
    // 1x1 (mismo criterio que un click de pincel pinta un solo pixel) --
    // siempre hay un `finalRect` desde el pointerdown, nunca `null` aca.
    if (finalRect) onRectCreated(finalRect);
  }

  // Fase 2 -- ajustar el rectangulo ya existente (rect !== null): mover
  // (arrastrar el cuerpo) o redimensionar (arrastrar la esquina), ambos
  // por DELTA de puntero (no por posicion absoluta, asi que no hace
  // falta descontar el borde de 1px aca) -- mismo algoritmo exacto que
  // `PasteImageOverlay.tsx`, con el agregado de recortar a los limites
  // del buffer en cada paso (ver comentario del prop `rect` de arriba).
  function handleDragPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, startRect: rect };
  }

  function handleDragPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dxTexels = Math.round((e.clientX - drag.startClientX) / scaleX);
    const dyTexels = Math.round((e.clientY - drag.startClientY) / scaleY);
    const moved = { ...drag.startRect, x: drag.startRect.x + dxTexels, y: drag.startRect.y + dyTexels };
    onRectChange(clampToBuffer(moved, bufferWidth, bufferHeight));
  }

  function handleDragPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function handleResizePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!rect) return;
    // Evita que el pointerdown tambien dispare `handleDragPointerDown`
    // del div contenedor -- mismo criterio que `PasteImageOverlay.tsx`.
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
    const resized = {
      ...resize.startRect,
      width: Math.max(1, resize.startRect.width + dxTexels),
      height: Math.max(1, resize.startRect.height + dyTexels),
    };
    onRectChange(clampToBuffer(resized, bufferWidth, bufferHeight));
  }

  function handleResizePointerEnd(e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const activeRect = rect ?? draftRect;

  return (
    <div
      role="group"
      aria-label={rect ? 'Seleccion de la textura -- arrastra para mover' : 'Selecciona un area de la textura -- arrastra para dibujar el rectangulo'}
      onPointerDown={rect ? handleDragPointerDown : handleDrawPointerDown}
      onPointerMove={rect ? handleDragPointerMove : handleDrawPointerMove}
      onPointerUp={rect ? handleDragPointerEnd : handleDrawPointerEnd}
      onPointerCancel={rect ? handleDragPointerEnd : handleDrawPointerEnd}
      style={{ position: 'absolute', inset: 0, cursor: rect ? 'move' : 'crosshair', touchAction: 'none' }}
    >
      {activeRect && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: activeRect.x * scaleX + TEXTURE_EDITOR_BORDER_WIDTH,
            top: activeRect.y * scaleY + TEXTURE_EDITOR_BORDER_WIDTH,
            width: activeRect.width * scaleX,
            height: activeRect.height * scaleY,
            border: '2px dashed var(--accent)',
            background: 'rgba(255, 214, 89, 0.12)',
            boxSizing: 'border-box',
          }}
        >
          {/* Handle de redimensionar + botones de accion: solo en fase 2 (rect ya confirmado) -- durante el arrastre de creacion (fase 1) el rectangulo es puramente informativo, sin controles propios todavia. */}
          {rect && (
            <>
              <button
                type="button"
                aria-label="Redimensionar seleccion"
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
              {/* Copiar/Cortar/Cancelar -- una sola linea (ver gotcha ya documentado del hook de accesibilidad con tags multilinea que contienen un `=>` en algun atributo, ej. `onPointerDown`); mismo patron que el grupo de confirmar/cancelar de `PasteImageOverlay.tsx`. */}
              <div role="group" aria-label="Copiar, cortar o cancelar la seleccion" onPointerDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                <button type="button" aria-label="Copiar seleccion" title="Copiar" onClick={onCopy} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'var(--accent)', color: '#0f171d', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}><IconCopy size={14} /></button>
                <button type="button" aria-label="Cortar seleccion" title="Cortar" onClick={onCut} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'var(--accent)', color: '#0f171d', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}><IconScissors size={14} /></button>
                <button type="button" aria-label="Cancelar seleccion" title="Cancelar" onClick={onCancel} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--border-strong)', background: 'var(--panel-bg)', color: 'var(--text)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}><IconX size={14} /></button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
