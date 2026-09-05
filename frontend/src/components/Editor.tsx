import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Viewer3D } from './Viewer3D';
import { TextureEditor } from './TextureEditor';
import { ColorPicker } from './ColorPicker';
import { HistoryControls } from './HistoryControls';
import { SymmetryControls } from './SymmetryControls';
import { ZoomControls } from './ZoomControls';
import { GridToggle } from './GridToggle';
import { ImportTextureControl } from './ImportTextureControl';
import { PasteImageControls } from './PasteImageControls';
import { PasteImageOverlay } from './PasteImageOverlay';
import { ExportControls } from './ExportControls';
import { decodeImageFileToImageData, decodePngDataUrlToImageData } from '../decodeTexture';
import { useCanvasTexture } from '../hooks/useCanvasTexture';
import { bresenhamLine, TextureBuffer, type PixelPoint, type PixelSource, type RGBA } from '../textureBuffer';
import { PaintHistory, type Stroke } from '../history';
import { computeUVBoxRects, mirrorPointHorizontal } from '../symmetry';
import { ZOOM_DEFAULT } from '../zoom';
import {
  computeBurnPixels,
  computeFullReplaceDiff,
  fitRectToBox,
  validateImportDimensions,
  type OverlayRect,
} from '../importImage';
import type { SkeletonBaseAssetsResponse } from '../types/baseAssets';

/** Imagen pegada/subida en espera de confirmar o descartar (ticket 005, HU-9) -- una a la vez (ver alcance del ticket). */
interface PendingPasteImage {
  source: PixelSource;
  previewUrl: string;
  rect: OverlayRect;
}

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
 * (HU-12): el pincel de `TextureEditor`, importar PNG completo
 * (`handleImportFile`, HU-8) y pegar/quemar imagen sobre una region UV
 * (`handleConfirmPaste`, HU-9, ticket 005) -- y, en tickets futuros, una
 * eventual generacion por IA -- escriben a traves de
 * `setPixel`/`loadFromImageData`, no hay logica de pintado acoplada al
 * manejo de eventos de mouse.
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

  // Hallazgo real de este ticket (005): el overlay de "pegar imagen"
  // (HU-9) necesita saber cuantos pixeles CSS REALES ocupa cada texel
  // en pantalla para alinearse con el canvas de `TextureEditor` -- pero
  // eso NO siempre es igual a `zoom`. `TextureEditor` renderiza su
  // `<canvas>` con `maxWidth: '100%'` (ver `TextureEditor.tsx`) dentro
  // de este `<aside>` de ancho FIJO (280px, ver mas abajo) -- al zoom
  // por defecto (1000% => 640px logicos de ancho) el navegador comprime
  // el ancho renderizado del canvas para que quepa (~230px en la
  // practica) SIN comprimir su alto (320px, sin restriccion), asi que
  // el canvas termina renderizando texeles NO cuadrados (`scaleX !=
  // scaleY`) -- una distorsion visual preexistente desde que el ticket
  // 002 fijo el factor de escala en X10 (agravada por el ticket 004 al
  // subir el rango de zoom), nunca antes evidenciada porque ningun
  // ticket anterior necesito medir el tamaño RENDERIZADO del canvas
  // (alcance de arreglar esa distorsion en si -- fuera de este ticket,
  // ver docs/ARQUITECTURA.md "Ticket 005"). Si el overlay asumiera
  // `zoom` como escala real, quedaria desalineado del area que el
  // usuario ve de verdad. Se mide el `<canvas>` real con
  // `ResizeObserver` (en vez de asumir un valor) para que el overlay
  // siga alineado sin depender de arreglar esa distorsion.
  const textureCanvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const [canvasDisplayScale, setCanvasDisplayScale] = useState({ scaleX: zoom, scaleY: zoom });

  useEffect(() => {
    const wrapper = textureCanvasWrapperRef.current;
    const canvasEl = wrapper?.querySelector('canvas');
    if (!canvasEl) return;

    function measure() {
      const rect = canvasEl!.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      setCanvasDisplayScale({ scaleX: rect.width / buffer.width, scaleY: rect.height / buffer.height });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvasEl);
    return () => observer.disconnect();
  }, [buffer, zoom, showGrid]);

  // Importar textura completa + pegar/insertar imagen sobre una region
  // UV (ticket 005, HU-8/HU-9). `importError`/`pasteError` son mensajes
  // de UI inline (nunca un aviso nativo del navegador -- criterio
  // explicito del ticket), independientes entre si porque son dos
  // flujos separados con su propio control en la barra lateral (ver
  // `ImportTextureControl`/`PasteImageControls`).
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingPaste, setPendingPaste] = useState<PendingPasteImage | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);

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

  // Importar PNG existente como punto de partida (ticket 005, HU-8).
  // Reemplaza TODO el contenido del buffer -- se registra como UNA
  // unica unidad de undo reutilizando el mismo `PaintHistory` del
  // ticket 003 (beginStroke/recordChange/commitStroke), sin necesidad
  // de una API de historial distinta para "un reemplazo completo": el
  // diff pixel a pixel (`computeFullReplaceDiff`, en `importImage.ts`)
  // ya produce exactamente el mismo shape (`PixelChange`) que un trazo
  // de pincel normal.
  const handleImportFile = useCallback(
    async (file: File) => {
      setImportError(null);
      let decoded: { imageData: ImageData; previewUrl: string };
      try {
        decoded = await decodeImageFileToImageData(file);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'No se pudo leer el archivo como PNG.');
        return;
      }
      // Esta funcion no necesita vista previa (HU-8 reemplaza de
      // inmediato, no hay overlay que confirmar) -- se revoca apenas se
      // termina de leer los pixeles.
      URL.revokeObjectURL(decoded.previewUrl);

      const dimensionError = validateImportDimensions(decoded.imageData, { width: buffer.width, height: buffer.height });
      if (dimensionError) {
        setImportError(dimensionError);
        return;
      }

      const currentSnapshot: PixelSource = { width: buffer.width, height: buffer.height, data: buffer.getRawData() };
      const changes = computeFullReplaceDiff(currentSnapshot, decoded.imageData);
      if (changes.length === 0) return; // PNG identico al actual -- no hay nada que reemplazar ni que apilar en el historial.

      buffer.loadFromImageData(decoded.imageData);
      history.beginStroke();
      changes.forEach((c) => history.recordChange(c.x, c.y, c.before, c.after));
      history.commitStroke();
      setVersion((v) => v + 1);
      setHistoryTick((t) => t + 1);
    },
    [buffer, history],
  );

  // Pegar/insertar imagen sobre una region UV (ticket 005, HU-9).
  // `startPendingPaste` es el punto de entrada COMUN a los dos
  // disparadores que pide el ticket: el evento `paste` del portapapeles
  // (listener a nivel de `window` mas abajo, mismo patron que los
  // atajos de Ctrl/Cmd+Z) y el campo de archivo de `PasteImageControls`.
  // Solo se admite una imagen pendiente a la vez (alcance explicito del
  // ticket, "se confirma o se descarta antes de pegar otra") -- un
  // segundo intento mientras ya hay una pendiente se ignora con un
  // mensaje, en vez de reemplazarla en silencio (perderia el trabajo de
  // reposicionamiento en curso sin avisar).
  const startPendingPaste = useCallback(
    async (fileOrBlob: File | Blob) => {
      if (pendingPaste) {
        setPasteError('Ya hay una imagen pendiente de confirmar o descartar -- resuelvela antes de pegar otra.');
        return;
      }
      try {
        const decoded = await decodeImageFileToImageData(fileOrBlob);
        // Posicion inicial (criterio de este ticket, ver `fitRectToBox`
        // en `importImage.ts`): ajustada por contencion y centrada
        // dentro de la PRIMERA caja UV que devuelve `computeUVBoxRects`
        // (la cabeza, en el orden actual de `skeletonGeometry.ts`).
        const firstBox = uvBoxes[0];
        const rect: OverlayRect = firstBox
          ? fitRectToBox(decoded.imageData, firstBox)
          : { x: 0, y: 0, width: decoded.imageData.width, height: decoded.imageData.height };
        setPasteError(null);
        setPendingPaste({ source: decoded.imageData, previewUrl: decoded.previewUrl, rect });
      } catch (err) {
        setPasteError(err instanceof Error ? err.message : 'No se pudo leer la imagen pegada/subida.');
      }
    },
    [pendingPaste, uvBoxes],
  );

  // Revoca el object URL de vista previa exactamente cuando cambia (una
  // imagen nueva reemplaza a la anterior, o se descarta/confirma) --
  // NO en cada actualizacion de `rect` durante el arrastre/redimension
  // (que crea un nuevo objeto `pendingPaste` en cada evento pero
  // conserva el MISMO `previewUrl`). Depender de `pendingPaste` entero
  // en vez de solo `.previewUrl` revocaria la URL todavia en uso en
  // cada frame de arrastre -- la imagen de vista previa desaparecería
  // a mitad de gesto.
  useEffect(() => {
    const url = pendingPaste?.previewUrl;
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [pendingPaste?.previewUrl]);

  const handlePendingRectChange = useCallback((rect: OverlayRect) => {
    setPendingPaste((prev) => (prev ? { ...prev, rect } : prev));
  }, []);

  const handleCancelPaste = useCallback(() => {
    setPendingPaste(null);
    setPasteError(null);
  }, []);

  // "Quemado" de la imagen pendiente sobre la textura (HU-9, criterio
  // de aceptacion "se aplica... respetando los limites de esa caja
  // UV"). `computeBurnPixels` ya resuelve la caja UV objetivo y recorta
  // el resultado a sus limites -- aca solo queda escribir cada pixel
  // resultante en el buffer y registrar el trazo en el historial, IGUAL
  // que cualquier otra escritura (leer "antes", escribir, registrar).
  const handleConfirmPaste = useCallback(() => {
    if (!pendingPaste) return;
    const writes = computeBurnPixels(pendingPaste.source, pendingPaste.rect, uvBoxes);
    if (!writes) {
      setPasteError(
        'La imagen no esta posicionada sobre ninguna region UV del modelo -- movela sobre una parte visible antes de confirmar.',
      );
      return;
    }

    history.beginStroke();
    let changed = false;
    writes.forEach((w) => {
      const before = buffer.getPixel(w.x, w.y);
      if (buffer.setPixel(w.x, w.y, w.color)) {
        history.recordChange(w.x, w.y, before, w.color);
        changed = true;
      }
    });
    history.commitStroke();

    if (changed) setVersion((v) => v + 1);
    setHistoryTick((t) => t + 1);
    setPasteError(null);
    setPendingPaste(null);
  }, [pendingPaste, uvBoxes, buffer, history]);

  // Disparador "pegar" del portapapeles (HU-9) -- listener a nivel de
  // `window`, mismo patron que los atajos de Ctrl/Cmd+Z de arriba (no
  // requiere foco en un elemento particular de la pagina).
  useEffect(() => {
    function handleWindowPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void startPendingPaste(file);
          }
          return;
        }
      }
    }
    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [startPendingPaste]);

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
          {/* Wrapper HERMANO de TextureEditor (no anidado dentro): asi el
              overlay de "pegar imagen" no queda recortado por el
              `overflow: hidden` propio de TextureEditor mientras se
              arrastra/redimensiona mas alla de su borde -- ver
              `PasteImageOverlay.tsx`. */}
          <div ref={textureCanvasWrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
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
            {pendingPaste && (
              <PasteImageOverlay
                rect={pendingPaste.rect}
                scaleX={canvasDisplayScale.scaleX}
                scaleY={canvasDisplayScale.scaleY}
                previewUrl={pendingPaste.previewUrl}
                onRectChange={handlePendingRectChange}
              />
            )}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-dim)' }}>Importar / pegar imagen</h2>
          <ImportTextureControl
            expectedWidth={buffer.width}
            expectedHeight={buffer.height}
            error={importError}
            onFileSelected={(file) => void handleImportFile(file)}
          />
          <PasteImageControls
            hasPending={!!pendingPaste}
            error={pasteError}
            onFileSelected={(file) => void startPendingPaste(file)}
            onConfirm={handleConfirmPaste}
            onCancel={handleCancelPaste}
          />
        </section>

        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-dim)' }}>Exportar</h2>
          <ExportControls buffer={buffer} />
        </section>
      </aside>
    </div>
  );
}
