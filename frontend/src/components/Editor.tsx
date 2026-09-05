import { useCallback, useEffect, useMemo, useState } from 'react';
import { Viewer3D } from './Viewer3D';
import { TextureEditor } from './TextureEditor';
import { ColorPicker } from './ColorPicker';
import { HistoryControls } from './HistoryControls';
import { SymmetryControls } from './SymmetryControls';
import { ZoomControls } from './ZoomControls';
import { GridToggle } from './GridToggle';
import { decodePngDataUrlToImageData } from '../decodeTexture';
import { useCanvasTexture } from '../hooks/useCanvasTexture';
import { bresenhamLine, TextureBuffer, type PixelPoint, type RGBA } from '../textureBuffer';
import { PaintHistory, type Stroke } from '../history';
import { computeUVBoxRects, mirrorPointHorizontal } from '../symmetry';
import { ZOOM_DEFAULT } from '../zoom';
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

  // Simetria de pintura (ticket 004, HU-6). `uvBoxes` se deriva de la
  // geometria servida por el backend (fuente de verdad, no
  // hardcodeada aca) -- ver `frontend/src/symmetry.ts` para la
  // justificacion completa de por que se ofrece un unico eje
  // (horizontal, dentro de la caja UV completa de cada parte).
  const [symmetryEnabled, setSymmetryEnabled] = useState(false);
  const uvBoxes = useMemo(() => computeUVBoxRects(geometry), [geometry]);

  // Zoom y cuadricula del editor de textura (ticket 004, HU-7). Estado
  // subido aca (no local a `TextureEditor`) porque los controles
  // (`ZoomControls`/`GridToggle`) viven como hermanos del canvas en el
  // panel lateral, no anidados dentro de el -- mismo patron ya usado
  // para `color`/`buffer`/`history`.
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [showGrid, setShowGrid] = useState(true);

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

  // Escritura unificada de pixeles con soporte de simetria opcional
  // (ticket 004). Reemplaza la version del ticket 003 que llamaba
  // directo a `buffer.setPixel`/`buffer.paintLine`: con simetria
  // activa, cada pixel "primario" (el que el usuario pinto de verdad)
  // puede tener una contraparte espejada (`mirrorPointHorizontal`) que
  // tambien hay que escribir -- y ambas escrituras deben quedar en el
  // MISMO trazo de `history` (un trazo simetrico sigue siendo una sola
  // unidad de undo, criterio explicito del ticket).
  //
  // Orden critico para que el "antes" del historial quede correcto:
  // 1) junta TODOS los puntos a escribir (primarios + sus espejos, sin
  //    duplicados -- un punto puede coincidir con su propio espejo, o
  //    el espejo de un punto puede coincidir con OTRO punto primario
  //    del mismo trazo/linea), 2) lee el color "antes" de cada uno
  //    ANTES de escribir ninguno, 3) recien entonces escribe y
  //    registra en `history`. Si se escribiera y leyera intercalado,
  //    un pixel cuyo "antes" se lee despues de que su espejo ya se
  //    escribio (caso: la linea de arrastre cruza la columna central
  //    de espejo) capturaria un "antes" incorrecto (el valor ya
  //    pintado, no el original).
  //
  // Por que ya no se usa `TextureBuffer.paintLine` desde aca: esa
  // funcion escribe y no expone el "antes" de cada celda (ver
  // docs/ARQUITECTURA.md, "Ticket 003") -- el ticket 003 lo resolvia
  // duplicando el mismo `bresenhamLine`+`inBounds` para leer el "antes"
  // en un paso separado ANTES de llamar a `buffer.paintLine`. Con
  // simetria, ese paso separado de lectura ya es indispensable
  // (arriba), asi que este helper hace la escritura el mismo con
  // `buffer.setPixel` en vez de tambien invocar `buffer.paintLine` --
  // evita escribir dos veces (una vez dentro de `buffer.paintLine`,
  // otra si hiciera falta ajustar algo) y mantiene una sola pasada.
  // `TextureBuffer.paintLine` sigue siendo la interfaz publica
  // documentada para HU-12 (otras fuentes de escritura futuras que no
  // necesiten simetria), solo que `Editor.tsx` ya no es quien la
  // invoca.
  const applyPixelsWithSymmetry = useCallback(
    (primaryPoints: PixelPoint[], rgba: RGBA) => {
      const primaryInBounds = primaryPoints.filter((p) => buffer.inBounds(p.x, p.y));

      const pointKey = (p: PixelPoint) => `${p.x},${p.y}`;
      const uniquePoints = new Map<string, PixelPoint>();
      primaryInBounds.forEach((p) => uniquePoints.set(pointKey(p), p));

      if (symmetryEnabled) {
        for (const p of primaryInBounds) {
          const mirror = mirrorPointHorizontal(p, uvBoxes);
          if (mirror && buffer.inBounds(mirror.x, mirror.y)) {
            uniquePoints.set(pointKey(mirror), mirror);
          }
        }
      }

      const points = Array.from(uniquePoints.values());
      if (points.length === 0) return;

      const befores = points.map((p) => buffer.getPixel(p.x, p.y));
      let changed = false;
      points.forEach((p, i) => {
        if (buffer.setPixel(p.x, p.y, rgba)) {
          history.recordChange(p.x, p.y, befores[i], rgba);
          changed = true;
        }
      });
      if (changed) setVersion((v) => v + 1);
    },
    [buffer, history, symmetryEnabled, uvBoxes],
  );

  const setPixel = useCallback(
    (x: number, y: number, rgba: RGBA) => {
      applyPixelsWithSymmetry([{ x, y }], rgba);
    },
    [applyPixelsWithSymmetry],
  );

  const paintLine = useCallback(
    (from: PixelPoint, to: PixelPoint, rgba: RGBA) => {
      applyPixelsWithSymmetry(bresenhamLine(from.x, from.y, to.x, to.y), rgba);
    },
    [applyPixelsWithSymmetry],
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
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-dim)' }}>Simetria</h2>
          <SymmetryControls enabled={symmetryEnabled} onToggle={setSymmetryEnabled} />
        </section>

        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-dim)' }}>Color</h2>
          <ColorPicker color={color} onChange={setColor} />
        </section>

        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-dim)' }}>Vista</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ZoomControls zoom={zoom} onChange={setZoom} />
            <GridToggle visible={showGrid} onToggle={setShowGrid} />
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-dim)' }}>
            Textura ({buffer.width}×{buffer.height})
          </h2>
          <TextureEditor
            buffer={buffer}
            version={version}
            color={color}
            zoom={zoom}
            onZoomChange={setZoom}
            showGrid={showGrid}
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
