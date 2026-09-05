import { useCallback, useEffect, useState } from 'react';
import { Viewer3D } from './Viewer3D';
import { TextureEditor } from './TextureEditor';
import { ColorPicker } from './ColorPicker';
import { HistoryControls } from './HistoryControls';
import { decodePngDataUrlToImageData } from '../decodeTexture';
import { useCanvasTexture } from '../hooks/useCanvasTexture';
import { bresenhamLine, TextureBuffer, type PixelPoint, type RGBA } from '../textureBuffer';
import { PaintHistory, type Stroke } from '../history';
import type { SkeletonBaseAssetsResponse } from '../types/baseAssets';

/** Color inicial seleccionado al abrir el editor (tono "hueso" de la paleta). */
const DEFAULT_COLOR = '#e3dcc5';

export interface EditorProps {
  data: SkeletonBaseAssetsResponse;
}

/**
 * Compone el visor 3D + editor de textura + selector de color sobre un
 * unico `TextureBuffer` compartido (ticket 002). El estado se sube
 * aca (en vez de en `App.tsx` o en un store aparte) porque solo se
 * necesita una vez que el asset base ya cargo -- mantiene `App.tsx`
 * enfocado en el fetch/loading/error de siempre (ver ticket 001).
 *
 * `TextureBuffer` es la UNICA interfaz de escritura sobre los pixeles
 * (HU-12): tanto el pincel de `TextureEditor` como -- en tickets
 * futuros -- importar/pegar imagen o una eventual generacion por IA
 * escriben a traves de `setPixel`/`paintLine`/`loadFromImageData`, no
 * hay logica de pintado acoplada al manejo de eventos de mouse.
 */
export function Editor({ data }: EditorProps) {
  const { texture: baseTexture, geometry } = data;

  const [buffer] = useState(() => new TextureBuffer(baseTexture.width, baseTexture.height));
  const [version, setVersion] = useState(0);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [initError, setInitError] = useState<string | null>(null);

  // Historial de deshacer/rehacer (ticket 003, HU-4). `PaintHistory` es
  // un objeto mutable (igual que `buffer`) -- `historyTick` no se lee
  // en ningun lado, solo su setter, para forzar un re-render cuando
  // cambia `canUndo`/`canRedo` (push/undo/redo/commit mutan el objeto
  // sin que React lo note por si solo). Ver docs/ARQUITECTURA.md,
  // "Ticket 003", para la justificacion de mantenerlo como modulo puro
  // separado de TextureBuffer en vez de mezclar la logica de historial
  // dentro del buffer.
  const [history] = useState(() => new PaintHistory());
  const [, setHistoryTick] = useState(0);

  // Carga inicial: decodifica el PNG (real o placeholder) que ya vino
  // en la respuesta de `GET /api/base-assets/skeleton` (ver App.tsx) y
  // lo vuelca al buffer compartido. A partir de aca el buffer vive solo
  // en memoria del navegador (sin persistencia server-side, decision
  // confirmada en la definicion).
  useEffect(() => {
    let cancelled = false;

    decodePngDataUrlToImageData(baseTexture.dataUrl, baseTexture.width, baseTexture.height)
      .then((imageData) => {
        if (cancelled) return;
        buffer.loadFromImageData(imageData);
        setVersion((v) => v + 1);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Error desconocido decodificando la textura base.';
        setInitError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [buffer, baseTexture.dataUrl, baseTexture.width, baseTexture.height]);

  // `setPixel`/`paintLine` capturan el color "antes" de escribir y lo
  // registran en el trazo en curso de `history` -- ver
  // docs/ARQUITECTURA.md, "Ticket 003", sobre por que `paintLine`
  // calcula sus propios `cells`/`befores` en vez de que
  // `TextureBuffer.paintLine` los exponga (mantiene `TextureBuffer` sin
  // conocimiento de historial).
  const setPixel = useCallback(
    (x: number, y: number, rgba: RGBA) => {
      const before = buffer.inBounds(x, y) ? buffer.getPixel(x, y) : null;
      if (buffer.setPixel(x, y, rgba)) {
        if (before) history.recordChange(x, y, before, rgba);
        setVersion((v) => v + 1);
      }
    },
    [buffer, history],
  );

  const paintLine = useCallback(
    (from: PixelPoint, to: PixelPoint, rgba: RGBA) => {
      // `cells` replica exactamente el filtro interno de
      // `TextureBuffer.paintLine` (mismo `bresenhamLine` + mismo
      // predicado `inBounds` que usa `setPixel`) -- garantiza que
      // coincide en orden y contenido con el `painted` que devuelve
      // `buffer.paintLine` mas abajo, sin duplicar la logica de
      // pintado en si.
      const cells = bresenhamLine(from.x, from.y, to.x, to.y).filter((p) => buffer.inBounds(p.x, p.y));
      const befores = cells.map((p) => buffer.getPixel(p.x, p.y));
      const painted = buffer.paintLine(from.x, from.y, to.x, to.y, rgba);
      if (painted.length > 0) {
        painted.forEach((p, i) => history.recordChange(p.x, p.y, befores[i], rgba));
        setVersion((v) => v + 1);
      }
    },
    [buffer, history],
  );

  const onStrokeStart = useCallback(() => {
    history.beginStroke();
  }, [history]);

  const onStrokeEnd = useCallback(() => {
    history.commitStroke();
    setHistoryTick((t) => t + 1);
  }, [history]);

  const applyStroke = useCallback(
    (stroke: Stroke, pick: (change: Stroke[number]) => RGBA) => {
      for (const change of stroke) {
        buffer.setPixel(change.x, change.y, pick(change));
      }
      setVersion((v) => v + 1);
    },
    [buffer],
  );

  const handleUndo = useCallback(() => {
    const stroke = history.undo();
    if (!stroke) return;
    applyStroke(stroke, (c) => c.before);
    setHistoryTick((t) => t + 1);
  }, [history, applyStroke]);

  const handleRedo = useCallback(() => {
    const stroke = history.redo();
    if (!stroke) return;
    applyStroke(stroke, (c) => c.after);
    setHistoryTick((t) => t + 1);
  }, [history, applyStroke]);

  // Atajos de teclado estandar (HU-4): Ctrl/Cmd+Z deshace,
  // Ctrl/Cmd+Shift+Z o Ctrl+Y rehace. Listener a nivel de `window` (no
  // requiere foco en un elemento particular de la pagina) -- el ticket
  // no pide manejar el caso de foco dentro de un input de texto de
  // forma especial, salvo el propio `<input type="color">` si
  // interfiere (verificado en vivo que no interfiere, ver checklist de
  // cierre).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const texture = useCanvasTexture(buffer, version);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <Viewer3D texture={texture} geometry={geometry} />
        {initError && (
          <p
            role="alert"
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              margin: 0,
              padding: '6px 10px',
              fontSize: 12,
              background: 'var(--panel-bg)',
              color: 'var(--text)',
              borderRadius: 4,
            }}
          >
            No se pudo cargar la textura inicial en el editor: {initError}
          </p>
        )}
      </div>

      <aside
        style={{
          width: 280,
          flexShrink: 0,
          overflowY: 'auto',
          padding: 16,
          background: 'var(--panel-bg)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-dim)' }}>Historial</h2>
          <HistoryControls canUndo={history.canUndo} canRedo={history.canRedo} onUndo={handleUndo} onRedo={handleRedo} />
        </section>

        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-dim)' }}>Color</h2>
          <ColorPicker color={color} onChange={setColor} />
        </section>

        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-dim)' }}>
            Textura ({buffer.width}×{buffer.height})
          </h2>
          <TextureEditor
            buffer={buffer}
            version={version}
            color={color}
            onSetPixel={setPixel}
            onPaintLine={paintLine}
            onStrokeStart={onStrokeStart}
            onStrokeEnd={onStrokeEnd}
          />
        </section>
      </aside>
    </div>
  );
}
