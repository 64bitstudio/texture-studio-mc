import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Viewer3D } from './Viewer3D';
import { TextureEditor } from './TextureEditor';
import { HsvColorPicker } from './HsvColorPicker';
import { ZoomControls } from './ZoomControls';
import { ImportTextureControl } from './ImportTextureControl';
import { PasteImageControls } from './PasteImageControls';
import { PasteImageOverlay } from './PasteImageOverlay';
import { ExportControls } from './ExportControls';
import { PartIsolationControls } from './PartIsolationControls';
import { ERASE_BRUSH_SIZE_MAX, ERASE_BRUSH_SIZE_MIN } from './EraseControls';
import { Button, InlineError, Menu, Section, Select } from '../ui';
import {
  IconBrush,
  IconCheck,
  IconDocument,
  IconEraser,
  IconExpand,
  IconGridView,
  IconLightbulb,
  IconMaximize,
  IconModel,
  IconRedo,
  IconRefresh,
  IconSave,
  IconScale,
  IconSymmetry,
  IconUndo,
} from '../ui/icons';
import { computeBrushFootprint, computeBrushFootprintForLine } from '../brush';
import { decodeImageFileToImageData, decodePngDataUrlToImageData } from '../decodeTexture';
import { useCanvasTexture } from '../hooks/useCanvasTexture';
import { bresenhamLine, TextureBuffer, type PixelPoint, type PixelSource, type RGBA } from '../textureBuffer';
import { PaintHistory, type Stroke } from '../history';
import { computeUVBoxRects, mirrorPointHorizontal } from '../symmetry';
import { computeNamedRegions, findRegionAt, type NamedUVRegion } from '../regionLabels';
import { isPixelInActiveRegion } from '../partIsolation';
import { ZOOM_DEFAULT } from '../zoom';
import { RESOLUTION_DEFAULT, RESOLUTION_MAX, RESOLUTION_MIN, clampResolutionMultiplier, resamplePixelSource } from '../resolution';
import { canvasOverflowsAvailableWidth, computeCanvasDisplaySize } from '../canvasSize';
import {
  computeBurnPixels,
  computeFullReplaceDiff,
  computeInitialPasteRect,
  validateImportDimensions,
  type OverlayRect,
} from '../importImage';
import { maskPixelsOutsideUVBoxes } from '../uvBoxCleanup';
import { buildProjectSnapshot } from '../projectSnapshot';
import { loadProject, saveProject } from '../projectStorage';
import type { MobBaseAssetsResponse } from '../types/baseAssets';

/** Imagen pegada/subida en espera de confirmar o descartar (ticket 005, HU-9) -- una a la vez (ver alcance del ticket). */
interface PendingPasteImage {
  source: PixelSource;
  previewUrl: string;
  rect: OverlayRect;
}

/** Color inicial seleccionado al abrir el editor (tono "hueso" de la paleta). */
const DEFAULT_COLOR = '#e3dcc5';

export interface EditorProps {
  data: MobBaseAssetsResponse;
  /** Id del mob activo (ticket 018) -- clave del buffer en `bufferCache` y del `mobId` de la API. */
  mobId: string;
  /** Nombre legible del mob activo (ticket 018) -- solo para el `aria-label` de `Viewer3D`. */
  mobLabel: string;
  /**
   * Cache de buffers en memoria, UNA instancia compartida y estable
   * entre renders de `App.tsx` (ver `docs/ARQUITECTURA.md`, "Ticket
   * 018") -- vive por fuera de este componente porque `Editor` se
   * remonta completo (`key={mobId}` en `App.tsx`) cada vez que el
   * usuario cambia de mob (la geometria/resolucion/historial/etc. de un
   * mob no tienen por que aplicar al otro), pero el PIXEL BUFFER si debe
   * sobrevivir ese remount -- es la unica pieza de estado que el ticket
   * exige mantener "por mob visitado en la sesion".
   */
  bufferCache: Map<string, TextureBuffer>;
  /**
   * Nombre del proyecto activo (ticket 072, pedido de Marco con imagen
   * de referencia) -- breadcrumb, título, y clave con la que "Guardar"
   * llama a `saveProject`. `Editor.tsx` sigue sin saber nada de
   * "proyecto" mas alla de este string (no lee/escribe `ProjectRecord`
   * directamente salvo en `handleSave`, ver mas abajo).
   */
  projectName: string;
  /** Ticket 072: click en "Mis proyectos" del breadcrumb -- navega a la lista completa (distinto de `onBackToProject`, que vuelve al detalle de ESTE proyecto). */
  onBackToProjectsList: () => void;
  /** Ticket 072: click en el nombre del proyecto (breadcrumb) o "Proyecto actual" (sidebar) -- vuelve al detalle del proyecto activo. */
  onBackToProject: () => void;
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
export function Editor({ data, mobId, mobLabel, bufferCache, projectName, onBackToProjectsList, onBackToProject }: EditorProps) {
  const { texture: baseTexture, geometry } = data;

  // Ticket 018 (buffer por mob visitado en la sesion): si ya existe un
  // buffer cacheado para ESTE mob (de una visita anterior en la misma
  // sesion), lo reusamos tal cual -- conserva exactamente los pixeles
  // pintados y la resolucion de trabajo con la que se dejo, sin volver
  // a decodificar la textura base de la red. Si es la primera visita,
  // arranca en blanco (mismo comportamiento que antes de este ticket) y
  // el efecto de carga inicial de mas abajo lo puebla con la textura
  // base ya decodificada.
  //
  // `hadCachedBuffer` se lee UNA sola vez (lazy initial state, mismo
  // patron ya usado por `loadStoredPanelWidth` en `panelWidth.ts`) --
  // este componente se remonta completo por cada mob (`key={mobId}` en
  // `App.tsx`), asi que "una vez" aca significa "una vez por visita a
  // este mob", que es exactamente lo que se necesita saber para decidir
  // si hay que decodificar la textura base o no.
  const [hadCachedBuffer] = useState(() => bufferCache.has(mobId));

  // `buffer` es reemplazable (no un unico `useState` sin setter) desde
  // el ticket 009: cambiar la resolucion de trabajo (`handleResolutionChange`
  // mas abajo) crea una NUEVA instancia de `TextureBuffer` con las
  // dimensiones nuevas -- `width`/`height` son `readonly` en
  // `TextureBuffer` a proposito (ver `textureBuffer.ts`, decision
  // original del ticket 002: las dimensiones de una instancia nunca
  // cambian a mitad de vida), asi que un cambio de tamaño real siempre
  // implica una instancia nueva, nunca mutar la existente.
  const [buffer, setBuffer] = useState(
    () => bufferCache.get(mobId) ?? new TextureBuffer(baseTexture.width, baseTexture.height),
  );

  // Registra (o actualiza) la instancia VIGENTE de `buffer` en la cache
  // compartida -- corre en el montaje inicial (primera visita: registra
  // el buffer recien creado; visita repetida: re-registra el mismo
  // objeto que ya estaba, no-op observable) y de nuevo cada vez que
  // `handleResolutionChange` reemplaza `buffer` por una instancia nueva
  // (cambio de resolucion de trabajo) -- sin este segundo caso, volver a
  // este mob despues de cambiar su resolucion perderia justo el cambio
  // de tamaño (aunque no el contenido, gracias al re-muestreo) porque la
  // cache seguiria apuntando a la instancia vieja.
  useEffect(() => {
    bufferCache.set(mobId, buffer);
  }, [bufferCache, mobId, buffer]);

  // FIX (ticket 019, encontrado al implementar HU-4 "misma resolucion de
  // trabajo" -- bug latente desde el ticket 018, nunca antes ejercitado
  // porque su QA en vivo no combino "cambiar de resolucion" con "cambiar
  // de mob y volver"): `resolution` arrancaba SIEMPRE en
  // `RESOLUTION_DEFAULT` (x1) sin importar el tamaño real del buffer
  // recuperado de `bufferCache` -- si un buffer cacheado (de una visita
  // anterior al mob, o de un proyecto recien cargado, ver
  // `MisProyectos.tsx`/`Recientes.tsx`) tenia una resolucion de trabajo
  // distinta de x1, `resolution` quedaba DESINCRONIZADO del tamaño real
  // del buffer. Como `uvBoxes`/`namedRegions` (mas abajo) se escalan por
  // `resolution`, no por `buffer.width`, esto rompia silenciosamente la
  // simetria, el aislamiento de partes y -- mas grave -- el masking de
  // exportacion (ticket 015): `encodeBufferToPngBlob` habria recibido
  // cajas UV a escala x1 contra un buffer x4, tratando la mayor parte
  // del lienzo como "fuera de cualquier caja UV" y forzandolo a
  // alpha=0 en la exportacion. Fix: se deriva la resolucion inicial de
  // la razon `buffer.width / baseTexture.width` (misma tecnica exacta
  // que usa `handleResolutionChange` mas abajo para construir buffers
  // nuevos) cuando el buffer viene de la cache -- mismo patron de lazy
  // initial state que `hadCachedBuffer`/`buffer` arriba, para leerlo UNA
  // sola vez al montar.
  const [resolution, setResolutionState] = useState(() => {
    const cached = bufferCache.get(mobId);
    if (!cached) return RESOLUTION_DEFAULT;
    return clampResolutionMultiplier(cached.width / baseTexture.width);
  });
  const [version, setVersion] = useState(0);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [initError, setInitError] = useState<string | null>(null);

  // Colores recientes (ticket 072, para `HsvColorPicker.tsx`) -- estado
  // vive ACA (no dentro del picker) para sobrevivir mientras el editor
  // siga montado, sin importar cuantas veces el picker mismo se
  // re-renderice. Prepend + dedup case-insensitive (mismo hex
  // repetido no genera una segunda entrada, solo sube al frente) +
  // tope fijo -- mismo criterio de "no acumular sin limite" que
  // `PaintHistory` (ver `history.ts`).
  const RECENT_COLORS_MAX = 8;
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const handleColorChange = useCallback((hex: string) => {
    setColor(hex);
    setRecentColors((prev) => [hex, ...prev.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, RECENT_COLORS_MAX));
  }, []);

  // Herramienta de borrado (ticket 030, HU-5). `paintMode` NO vive junto
  // a `color` porque son ejes independientes -- el color seleccionado
  // se conserva mientras se borra, para que al desactivar "Borrar" el
  // usuario siga pintando con el mismo color de antes. `eraseBrushSize`
  // (1-5, ver `EraseControls.tsx`) solo aplica en modo borrado -- el
  // pincel de pintar normal sigue siendo de un pixel, sin cambios (ver
  // docs/definiciones/rediseno-ux-ui-y-navegacion.md, "No incluye").
  const [paintMode, setPaintMode] = useState<'paint' | 'erase'>('paint');
  const [eraseBrushSize, setEraseBrushSize] = useState(1);
  const ERASE_RGBA: RGBA = { r: 0, g: 0, b: 0, a: 0 };

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
  // `scale = resolution` (ticket 009): la geometria del backend describe
  // el UV en pixeles NATIVOS (x1) -- a una resolucion de trabajo mayor,
  // esas cajas deben escalarse proporcionalmente para seguir
  // correspondiendo a las coordenadas reales del `TextureBuffer` activo
  // (ver `symmetry.ts`). Simetria (HU-6) y pegado de imagen (HU-9,
  // `findTargetUVBox`/`clampRectToBox` en `importImage.ts`) consumen
  // `uvBoxes` ya escalado, sin ningun cambio propio.
  const uvBoxes = useMemo(() => computeUVBoxRects(geometry, resolution), [geometry, resolution]);

  // Catalogo de regiones UV nombradas (ticket 011) -- mismo criterio de
  // `scale = resolution` que `uvBoxes` arriba (la geometria del backend
  // describe el UV en pixeles nativos x1, ver `regionLabels.ts`).
  // Reusado directamente por el ticket 012 (aislar parte para pintar)
  // sin redefinir el catalogo, tal como pide el alcance de este ticket.
  const namedRegions = useMemo(() => computeNamedRegions(geometry, resolution), [geometry, resolution]);
  const [hoveredRegion, setHoveredRegion] = useState<NamedUVRegion | null>(null);
  const handleHoverPixel = useCallback(
    (point: PixelPoint | null) => {
      setHoveredRegion(point ? findRegionAt(point, namedRegions) : null);
    },
    [namedRegions],
  );

  // Aislar una parte para pintar (ticket 012). Solo se guarda el `id`
  // (estable entre cambios de resolucion/escala, ver `regionLabels.ts`)
  // -- el rectangulo real (`isolatedRegion` de abajo) se re-deriva de
  // `namedRegions`, que ya se recalcula solo con la escala vigente, asi
  // que un cambio de resolucion NO desalinea la parte aislada (a
  // diferencia de `hoveredRegion`, que si se limpia explicitamente mas
  // abajo porque depende de la POSICION del cursor, no de un id
  // estable).
  //
  // Estado deliberadamente expuesto tal cual (no envuelto en un hook
  // propio) para que el ticket 013 (pegado de imagen con ajuste
  // automatico a la parte aislada, que depende de este ticket) pueda
  // leer `isolatedRegion` (en particular su `.rect`) directamente sin
  // tener que rehacer este trabajo -- ver docs/ARQUITECTURA.md, "Ticket
  // 012".
  const [isolatedRegionId, setIsolatedRegionId] = useState<string | null>(null);
  const isolatedRegion = useMemo(
    () => (isolatedRegionId ? (namedRegions.find((r) => r.id === isolatedRegionId) ?? null) : null),
    [namedRegions, isolatedRegionId],
  );

  // Mensaje de bloqueo de pintado fuera de la parte aislada (ticket
  // 012, criterio "nunca fallo silencioso"). Se activa cuando el punto
  // PRIMARIO (el pixel que el usuario intento pintar de verdad, no una
  // contraparte de simetria) cae fuera de `isolatedRegion` -- ver
  // `applyPixelsWithSymmetry` mas abajo. Se limpia apenas el usuario
  // pinta con exito dentro de la region, o al desactivar/cambiar el
  // aislamiento.
  const [paintBlockedByIsolation, setPaintBlockedByIsolation] = useState(false);

  const handleSelectIsolatedPart = useCallback((regionId: string | null) => {
    setIsolatedRegionId(regionId);
    setPaintBlockedByIsolation(false);
  }, []);

  // Zoom y cuadricula del editor de textura (ticket 004, HU-7). Estado
  // subido aca (no local a `TextureEditor`) porque los controles
  // (`ZoomControls`/`GridToggle`) viven como hermanos del canvas en el
  // panel lateral, no anidados dentro de el -- mismo patron ya usado
  // para `color`/`buffer`/`history`.
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [showGrid, setShowGrid] = useState(true);

  // Escala real renderizada del canvas: el overlay de "pegar imagen" (HU-9, ticket 005) necesita
  // saber cuantos pixeles CSS REALES ocupa cada texel en pantalla para
  // alinearse con el canvas de `TextureEditor` -- antes del ticket 010
  // eso NO siempre era igual a `zoom`, porque `TextureEditor` renderizaba
  // su `<canvas>` con `maxWidth: '100%'` dentro de un `<aside>` de ancho
  // FIJO (280px), y el navegador comprimia solo el ancho sin ajustar el
  // alto (texeles no cuadrados, ver docs/ARQUITECTURA.md "Ticket 005").
  // **Ticket 010 elimina esa distorsion en la fuente** (`TextureEditor`
  // ya no usa `maxWidth`, ver `canvasSize.ts`) -- `scaleX` y `scaleY`
  // medidos aca deberian ser SIEMPRE iguales entre si ahora, sin
  // importar el ancho del panel (verificado en vivo, ver checklist de
  // cierre). Se mantiene la medicion real via `ResizeObserver` (en vez
  // de asumir `zoom` directo) por el mismo criterio defensivo de
  // siempre: medir lo renderizado de verdad, no asumirlo.
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

  // Ancho REAL disponible para el editor de textura dentro del panel
  // (ticket 010, mismo patron de medicion con `ResizeObserver` que ya
  // usa el efecto de arriba) -- se usa exclusivamente para decidir si
  // el contenedor debe scrollear horizontalmente cuando el canvas (a
  // la resolucion/zoom actuales) no cabe, NUNCA para encoger el canvas
  // en si (ver `canvasSize.ts`, `computeCanvasDisplaySize` es
  // independiente de este valor por diseño). Sigue siendo necesario
  // tras el ticket 029 (panel de ancho flexible, ya no redimensionable
  // a mano): el panel puede seguir siendo mas angosto que el canvas a
  // resoluciones/zoom altos, sobre todo en ventanas chicas.
  const textureSectionWrapperRef = useRef<HTMLDivElement | null>(null);
  const [availableTextureWidth, setAvailableTextureWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = textureSectionWrapperRef.current;
    if (!el) return;

    function measure() {
      setAvailableTextureWidth(el!.clientWidth);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const canvasDisplaySize = computeCanvasDisplaySize(buffer.width, buffer.height, zoom);
  const textureOverflowsPanel = canvasOverflowsAvailableWidth(canvasDisplaySize.width, availableTextureWidth);

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
  // en la respuesta de `GET /api/base-assets/:mobId` (ver App.tsx) y lo
  // vuelca al buffer compartido. A partir de aca el buffer vive solo en
  // memoria del navegador (sin persistencia server-side, decision
  // confirmada en la definicion).
  //
  // Ticket 018 -- se SALTA por completo si `hadCachedBuffer` es true: el
  // usuario ya visito este mob antes en la sesion y su buffer (con lo
  // que haya pintado) ya esta cargado desde el `useState` de arriba --
  // sobreescribirlo con la textura base recien fetcheada perderia
  // exactamente el trabajo que este ticket exige preservar. Sin este
  // guard, volver a un mob ya visitado repintaria su buffer con la
  // textura vanilla original en cada cambio de mob.
  //
  // Ticket 009 -- NO depende de `buffer` (a diferencia de antes de este
  // ticket): un cambio de resolucion reemplaza `buffer` por una
  // instancia NUEVA (`setBuffer` mas abajo), y este componente corre
  // bajo `<StrictMode>` (`main.tsx`), que en desarrollo invoca cada
  // efecto DOS veces (monta -> limpia -> vuelve a montar) para detectar
  // efectos sin cleanup -- un guard de "ya corri una vez" con un `ref`
  // rompe justo esa segunda invocacion (la promesa de la primera ya
  // quedo cancelada por el cleanup, y el guard bloquea que la segunda
  // vuelva a intentarlo), dejando el buffer sin cargar nunca (bug real
  // detectado en la revision visual en vivo de este ticket: el modelo
  // se veia completamente negro). En vez de un guard, se usa la forma
  // funcional de `setBuffer` para escribir siempre sobre el buffer
  // VIGENTE al momento en que la decodificacion termina (nunca uno ya
  // reemplazado por un cambio de resolucion mientras tanto) y se
  // descarta en silencio si sus dimensiones ya no coinciden con la
  // textura nativa decodificada (el usuario cambio de resolucion antes
  // de que terminara esta carga inicial -- extremadamente improbable,
  // el decode de un PNG nativo es casi instantaneo, ver ticket 002, pero
  // de ocurrir no hay nada razonable que cargar sobre un buffer de otro
  // tamaño).
  useEffect(() => {
    if (hadCachedBuffer) return;
    let cancelled = false;

    decodePngDataUrlToImageData(baseTexture.dataUrl, baseTexture.width, baseTexture.height)
      .then((imageData) => {
        if (cancelled) return;
        setBuffer((current) => {
          if (current.width !== imageData.width || current.height !== imageData.height) return current;
          current.loadFromImageData(imageData);
          return current;
        });
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
  }, [baseTexture.dataUrl, baseTexture.width, baseTexture.height, hadCachedBuffer]);

  // Cambio de resolucion de trabajo (ticket 009, x1-x10): re-muestrea el
  // contenido ACTUAL del buffer (nearest-neighbor, ver `resolution.ts`
  // para el criterio completo de escalar arriba/abajo) a las nuevas
  // dimensiones -- `nativeWidth/Height * resolucion nueva` -- y lo
  // reemplaza por una instancia nueva de `TextureBuffer` (sus
  // dimensiones son `readonly`, ver arriba). Limpia el historial de
  // undo/redo y cancela cualquier pegado pendiente porque ambos quedan
  // atados a coordenadas del tamaño ANTERIOR (ver `PaintHistory.clear`
  // en `history.ts` para la justificacion completa).
  const handleResolutionChange = useCallback(
    (next: number) => {
      const clamped = clampResolutionMultiplier(next);
      if (clamped === resolution) return;

      const newWidth = baseTexture.width * clamped;
      const newHeight = baseTexture.height * clamped;
      const current: PixelSource = { width: buffer.width, height: buffer.height, data: buffer.getRawData() };
      const resampled = resamplePixelSource(current, newWidth, newHeight);
      const newBuffer = new TextureBuffer(newWidth, newHeight, resampled.data);

      history.clear();
      setHistoryTick((t) => t + 1);
      setPendingPaste(null);
      setPasteError(null);
      // `namedRegions` se recalcula con el nuevo `resolution` (ver
      // `useMemo` de arriba) -- el `hoveredRegion` guardado apunta a un
      // rectangulo de la escala ANTERIOR, se limpia para no mostrar un
      // nombre de region potencialmente desalineado hasta el proximo
      // `pointermove` (ticket 011).
      setHoveredRegion(null);
      // `isolatedRegionId` NO se limpia (ver comentario en su
      // declaracion) -- solo el mensaje de bloqueo, que si depende de
      // intentos de pintado a la escala ANTERIOR.
      setPaintBlockedByIsolation(false);

      setBuffer(newBuffer);
      setResolutionState(clamped);
      setVersion((v) => v + 1);
    },
    [resolution, buffer, baseTexture.width, baseTexture.height, history],
  );

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

      // Aislar una parte para pintar (ticket 012): con `isolatedRegion`
      // activo, SOLO los puntos que caen dentro de esa region se
      // escriben -- tanto el/los punto(s) primario(s) (click/brocha)
      // como cualquier contraparte de simetria que haya caido fuera se
      // descartan aca, ANTES de leer/escribir nada, para que ni
      // `history` ni `version` se enteren de un intento bloqueado (no es
      // una nueva unidad de historial, es un filtro de que puntos
      // llegan a escribirse siquiera -- ver alcance del ticket).
      //
      // El aviso de "bloqueado" (`paintBlockedByIsolation`) se basa
      // SOLO en los puntos PRIMARIOS (el pixel que el usuario realmente
      // intento pintar), no en las contrapartes de simetria descartadas
      // -- una contraparte de simetria fuera de la parte aislada se
      // descarta en silencio, mismo criterio ya establecido por
      // `mirrorPointHorizontal` al no encontrar contraparte valida (ver
      // `partIsolation.ts`).
      if (isolatedRegion) {
        const anyPrimaryBlocked = primaryInBounds.some((p) => !isPixelInActiveRegion(p, isolatedRegion));
        setPaintBlockedByIsolation(anyPrimaryBlocked);
      }

      const points = Array.from(uniquePoints.values()).filter((p) => isPixelInActiveRegion(p, isolatedRegion));
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
    [buffer, history, symmetryEnabled, uvBoxes, isolatedRegion],
  );

  // Ticket 030: el tamaño de pincel SOLO expande el punto/linea cuando
  // `paintMode === 'erase'` -- pintar normal (`paintMode === 'paint'`)
  // sigue siendo exactamente un pixel por punto, sin cambios. La
  // expansion pasa por `computeBrushFootprint`/`computeBrushFootprintForLine`
  // (puras, `brush.ts`) ANTES de `applyPixelsWithSymmetry`, que ya
  // deduplica/filtra por simetria y aislar-parte sobre CUALQUIER lista
  // de puntos que reciba -- el pincel de borrado no necesita logica
  // propia de simetria/aislamiento, hereda la misma.
  const setPixel = useCallback(
    (x: number, y: number, rgba: RGBA) => {
      const points = paintMode === 'erase' ? computeBrushFootprint({ x, y }, eraseBrushSize) : [{ x, y }];
      applyPixelsWithSymmetry(points, rgba);
    },
    [applyPixelsWithSymmetry, paintMode, eraseBrushSize],
  );

  const paintLine = useCallback(
    (from: PixelPoint, to: PixelPoint, rgba: RGBA) => {
      const linePoints = bresenhamLine(from.x, from.y, to.x, to.y);
      const points = paintMode === 'erase' ? computeBrushFootprintForLine(linePoints, eraseBrushSize) : linePoints;
      applyPixelsWithSymmetry(points, rgba);
    },
    [applyPixelsWithSymmetry, paintMode, eraseBrushSize],
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
  //
  // FIX ticket 015 (Parte B -- fuga real identificada, ver
  // `pending/015-bug-hat-overlay-contaminado-en-export.md`): esta
  // funcion solo validaba dimensiones (`validateImportDimensions`)
  // antes de volcar el PNG importado tal cual al buffer entero, sin
  // ninguna restriccion a las cajas UV conocidas -- un PNG externo
  // (ej. un export previo re-importado, o cualquier imagen 64x32/NxM
  // editada fuera de la app) con contenido opaco en la caja "hat" u
  // otro hueco del layout clasico quedaba incrustado en el buffer sin
  // que nada lo limpiara hasta este ticket. Se aplica el mismo
  // `maskPixelsOutsideUVBoxes` que usa `export.ts` a la imagen
  // DECODIFICADA antes de diffear/cargarla -- el contenido dentro de
  // las cajas se importa intacto, solo se fuerza alpha=0 en lo que
  // caiga fuera de ellas (zona que de todas formas Minecraft nunca
  // renderiza como parte real del modelo).
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

      const cleanedImport = maskPixelsOutsideUVBoxes(decoded.imageData, uvBoxes);
      const currentSnapshot: PixelSource = { width: buffer.width, height: buffer.height, data: buffer.getRawData() };
      const changes = computeFullReplaceDiff(currentSnapshot, cleanedImport);
      if (changes.length === 0) return; // PNG identico al actual (ya limpio) -- no hay nada que reemplazar ni que apilar en el historial.

      buffer.loadFromImageData(cleanedImport);
      history.beginStroke();
      changes.forEach((c) => history.recordChange(c.x, c.y, c.before, c.after));
      history.commitStroke();
      setVersion((v) => v + 1);
      setHistoryTick((t) => t + 1);
    },
    [buffer, history, uvBoxes],
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
        // Posicion inicial: `computeInitialPasteRect` (ticket 013)
        // decide entre dos caminos --
        // - Con una parte aislada activa (ticket 012, `isolatedRegion`):
        //   ajusta EXACTO (estirado) a las dimensiones de esa region,
        //   sin necesidad de ajuste manual previo a confirmar (criterio
        //   de aceptacion del ticket 013).
        // - Sin parte aislada: comportamiento EXACTO del ticket 005 sin
        //   cambios -- ajuste por contencion, centrado dentro de la
        //   PRIMERA caja UV que devuelve `computeUVBoxRects` (la
        //   cabeza, en el orden actual de `skeletonGeometry.ts`), o el
        //   tamaño original si no hay ninguna caja UV conocida.
        const rect: OverlayRect = computeInitialPasteRect(decoded.imageData, isolatedRegion?.rect ?? null, uvBoxes[0] ?? null);
        setPasteError(null);
        setPendingPaste({ source: decoded.imageData, previewUrl: decoded.previewUrl, rect });
      } catch (err) {
        setPasteError(err instanceof Error ? err.message : 'No se pudo leer la imagen pegada/subida.');
      }
    },
    [pendingPaste, uvBoxes, isolatedRegion],
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

  // "Restablecer" cámara del visor 3D (ticket 072). No hay API expuesta
  // por `Viewer3D`/`OrbitControls` para resetear la cámara sin
  // desmontar (ver `docs/ARQUITECTURA.md`, "Ticket 072") -- se fuerza un
  // remount completo incrementando `viewerKey`, mismo patrón ya usado
  // en `App.tsx` (`key={selectedMobId}`) para remontar `Editor`
  // completo al cambiar de mob.
  const [viewerKey, setViewerKey] = useState(0);
  const handleResetViewer = useCallback(() => setViewerKey((k) => k + 1), []);

  // "Pantalla completa" del visor 3D (ticket 072) -- Fullscreen API
  // nativa sobre el `<div>` que envuelve `Viewer3D` (no todo el
  // documento): el `fullscreenchange` a nivel de `document` es la unica
  // forma confiable de saber si SIGUE en pantalla completa (ej. el
  // usuario sale con Esc en vez de re-clickear el boton).
  const viewerWrapperRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === viewerWrapperRef.current);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  const handleToggleFullscreen = useCallback(() => {
    const el = viewerWrapperRef.current;
    if (!el) return;
    // `.catch` explicito con log (no solo `void`): el navegador puede
    // rechazar `requestFullscreen`/`exitFullscreen` (ej. politica de
    // permisos, o un gesto de click no considerado "confiable" --
    // verificado en vivo en la revision de este ticket, ver checklist
    // de cierre). No hay nada mas accionable que ofrecerle al usuario
    // en ese caso (el boton simplemente no tuvo efecto, ya es evidente
    // por si solo) -- se loguea para diagnostico en vez de mostrar un
    // error dedicado para una funcionalidad puramente cosmetica, en vez
    // de tragarse el rechazo en silencio.
    if (document.fullscreenElement === el) {
      document.exitFullscreen().catch((err: unknown) => {
        console.warn('No se pudo salir de pantalla completa del visor 3D:', err);
      });
    } else {
      el.requestFullscreen().catch((err: unknown) => {
        console.warn('No se pudo activar pantalla completa del visor 3D:', err);
      });
    }
  }, []);

  // "Guardar" (ticket 072, pedido de Marco: el editor rediseñado
  // necesita guardar de vuelta al proyecto sin pasar por "Agregar mob").
  // Reusa `buildProjectSnapshot` (ticket 019/045, ya usado por
  // `NuevoProyecto.tsx`/`AgregarMobModal.tsx`) con Maps de UNA sola
  // entrada (solo el mob activo -- `Editor` no tiene visibilidad de los
  // buffers de OTROS mobs del proyecto que el usuario no haya visitado
  // en esta sesion, ver `bufferCache`/`geometryCache` en
  // `projectSnapshot.ts`), y lo mergea sobre el `ProjectRecord`
  // existente en vez de reemplazarlo entero -- mismo patron ya usado
  // por `AgregarMobModal.tsx` para no pisar el trabajo de otros mobs ya
  // guardados.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const snapshot = await buildProjectSnapshot(new Map([[mobId, buffer]]), new Map([[mobId, geometry]]));
      const existing = loadProject(projectName);
      saveProject(projectName, { ...(existing?.mobs ?? {}), ...snapshot }, { overwrite: true });
      setSavedJustNow(true);
      window.setTimeout(() => setSavedJustNow(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el proyecto.');
    } finally {
      setSaving(false);
    }
  }, [mobId, buffer, geometry, projectName]);

  const texture = useCanvasTexture(buffer, version);

  // Opciones x1-x10 del `<Select>` de "Resolución" de la barra de
  // herramientas (ver mas abajo) -- mismo rango que `ResolutionControls.tsx`
  // (`RESOLUTION_MIN`/`RESOLUTION_MAX`), reconstruido aca en vez de reusar
  // ese componente porque su layout (`FormField`, label arriba del select)
  // no encaja en una fila horizontal de una sola linea.
  const resolutionOptions: number[] = [];
  for (let n = RESOLUTION_MIN; n <= RESOLUTION_MAX; n++) resolutionOptions.push(n);

  return (
    // `ts-fade-in` (ticket 032, HU-7): transicion corta al cambiar de
    // mob -- `Editor` remonta por completo (`key`, ticket 018) cada vez
    // que cambia el mob activo, asi que un fundido de entrada por
    // MONTAJE (no una `transition` sobre una propiedad que cambia con
    // el componente ya en pantalla) es lo que corresponde aqui.
    //
    // Ticket 072 (pedido de Marco, con imagen de referencia): rediseño
    // completo de este layout -- breadcrumb + título/badge/acciones +
    // barra de herramientas horizontal + cuerpo en 3 columnas (color /
    // textura / visor+info), reemplazando el visor fijo a la izquierda +
    // grid de `Section` sueltas de los tickets 025-031. La ÚNICA parte
    // que NO cambia (instrucción explícita de Marco: "la parte de la
    // textura en si... mantenlo como lo tenemos nosotros") es el propio
    // `Section` "Textura" de más abajo -- mismo JSX, mismos props, solo
    // reubicado a la columna central.
    <div className="ts-fade-in" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Corrección de Marco (revisión en vivo del ticket 072):
          "Guardar"/"Exportar PNG" suben a la altura del breadcrumb (no
          de la fila de título) -- mismo `justifyContent: 'space-between'`
          que antes tenía la fila de título, ahora en esta fila. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <nav aria-label="Ruta" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={onBackToProjectsList} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
            Mis proyectos
          </button>
          <span aria-hidden="true">›</span>
          <button type="button" onClick={onBackToProject} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
            {projectName}
          </button>
          <span aria-hidden="true">›</span>
          <span style={{ color: 'var(--text)' }}>{mobLabel}</span>
        </nav>

        {/* "Guardar" (nuevo, ticket 072) + "Exportar" (promovido desde el
            menú "Archivo", mismo `ExportControls` sin cambios de lógica). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {saveError && <InlineError message={saveError} />}
          {savedJustNow && (
            <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)', color: 'var(--accent)' }}>
              <IconCheck size={14} /> Guardado
            </span>
          )}
          <Button onClick={() => void handleSave()} disabled={saving}>
            <IconSave size={16} /> {saving ? 'Guardando…' : 'Guardar'}
          </Button>
          <ExportControls buffer={buffer} uvBoxes={uvBoxes} />
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Fila de título (ticket 072): nombre REAL del mob (sin apodo
          propio -- confirmado con Marco vía AskUserQuestion, ver
          `EditorProjectSidebar.tsx`) + badge fijo "Minecraft Java
          Edition" (mismo estilo que `Proyecto.tsx`/`NuevoProyecto.tsx`). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconModel size={22} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>{mobLabel}</h2>
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text)', background: 'var(--chip-bg)', borderRadius: 10, padding: '6px 12px', whiteSpace: 'nowrap' }}>
          Minecraft Java Edition
        </span>
      </div>

      {/* Barra de herramientas (ticket 072, pedido de Marco con imagen
          de referencia): reemplaza los `Section` sueltos "Historial"/
          "Simetria"/"Borrar"/"Vista" por una unica fila horizontal --
          MISMOS handlers/estado que antes (`handleUndo`/`handleRedo`/
          `paintMode`/`symmetryEnabled`/`showGrid`/`eraseBrushSize`), sin
          logica nueva. "Selector"/"Copiar"/"Recortar" de la imagen de
          referencia se OMITEN a proposito -- no tienen un equivalente
          funcional real hoy en la app (regla 8 de CLAUDE.md, "sin
          parches silenciosos": no se construyen botones decorativos que
          no hagan nada) -- decision a confirmar con Marco al presentar
          este ticket. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <div role="group" aria-label="Herramienta de pintura" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Button variant={paintMode === 'paint' ? 'primary' : 'secondary'} aria-pressed={paintMode === 'paint'} title="Pincel" onClick={() => setPaintMode('paint')}>
            <IconBrush size={16} /> Pincel
          </Button>
          <Button variant={paintMode === 'erase' ? 'primary' : 'secondary'} aria-pressed={paintMode === 'erase'} title="Borrador" onClick={() => setPaintMode('erase')}>
            <IconEraser size={16} /> Borrador
          </Button>
          {/* Tamaño de pincel del borrador (ticket 030) -- reubicado aca
              (era un slot fijo "Tamaño" de la barra, corregido por
              Marco: ese slot es para "Resolución", ver mas abajo). Solo
              visible con "Borrador" activo, mismo criterio que
              `EraseControls.tsx` original (no aplica al modo Pincel).
              El input va en una sola linea -- ver gotcha ya documentado
              de `ui-accessibility-guard.sh` con tags multilinea. */}
          {paintMode === 'erase' && (
            <div className="ts-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
              <input id="editor-erase-brush-size" type="range" min={ERASE_BRUSH_SIZE_MIN} max={ERASE_BRUSH_SIZE_MAX} value={eraseBrushSize} onChange={(e) => setEraseBrushSize(Number(e.target.value))} aria-label="Tamaño del pincel de borrado" title="Tamaño del pincel de borrado" style={{ width: 80 }} />
              <span aria-hidden="true" style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', minWidth: 28 }}>
                {eraseBrushSize}×{eraseBrushSize}
              </span>
            </div>
          )}
        </div>

        <div aria-hidden="true" style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />

        <div role="group" aria-label="Deshacer y rehacer" style={{ display: 'flex', gap: 6 }}>
          <Button variant="icon-square" title="Deshacer (Ctrl/Cmd+Z)" onClick={handleUndo} disabled={!history.canUndo}>
            <IconUndo size={16} />
          </Button>
          <Button variant="icon-square" title="Rehacer (Ctrl/Cmd+Shift+Z o Ctrl+Y)" onClick={handleRedo} disabled={!history.canRedo}>
            <IconRedo size={16} />
          </Button>
        </div>

        <div aria-hidden="true" style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />

        {/* Corrección de Marco (revisión en vivo del ticket 072): el
            slot "Tamaño" de la barra de herramientas confundía con el
            tamaño de pincel del borrador -- lo que va aca es la
            RESOLUCIÓN de trabajo (x1-x10, `ResolutionControls`,
            reubicada desde "Herramientas adicionales" a este slot).
            `<Select>` inline (no `ResolutionControls`/`FormField`
            completo, cuyo layout es label-arriba-select -- no encaja en
            esta fila horizontal de una sola línea, mismo patrón que el
            resto de grupos de la barra). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="editor-resolution" style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
            Resolución
          </label>
          <Select
            id="editor-resolution"
            value={resolution}
            onChange={(e) => handleResolutionChange(Number(e.target.value))}
            aria-label="Resolución de trabajo del editor de textura"
            style={{ minWidth: 130 }}
          >
            {resolutionOptions.map((n) => (
              <option key={n} value={n}>
                ×{n} ({baseTexture.width * n}×{baseTexture.height * n})
              </option>
            ))}
          </Select>
        </div>

        <div aria-hidden="true" style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />

        <div role="group" aria-label="Simetría y cuadrícula" style={{ display: 'flex', gap: 6 }}>
          <Button variant={symmetryEnabled ? 'primary' : 'secondary'} aria-pressed={symmetryEnabled} title="Simetría horizontal" onClick={() => setSymmetryEnabled((v) => !v)}>
            <IconSymmetry size={16} /> Simetría
          </Button>
          <Button variant={showGrid ? 'primary' : 'secondary'} aria-pressed={showGrid} title="Mostrar cuadrícula" onClick={() => setShowGrid((v) => !v)}>
            <IconGridView size={16} /> Cuadrícula
          </Button>
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <ZoomControls zoom={zoom} onChange={setZoom} />
        </div>
      </div>

      {/* Cuerpo en 3 columnas (ticket 072): selector de color / textura
          (SIN CAMBIOS, ver comentario de arriba) / visor 3D + paneles de
          info. `flexWrap` para ventanas angostas -- mismo criterio
          "resiliente al ancho real" que ya usaba el grid `auto-fit`
          anterior. */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Section title="Selector de color" style={{ width: 260, flexShrink: 0 }}>
          <HsvColorPicker color={color} onChange={handleColorChange} recentColors={recentColors} />
        </Section>

        {/* Ocupa TODAS las columnas del grid (`gridColumn: '1 / -1'`) --
            a diferencia del resto de secciones (controles compactos),
            el editor de pixeles se beneficia de todo el ancho
            disponible, sobre todo a resoluciones/zoom altos. */}
        <Section title={`Textura (${buffer.width}×${buffer.height})`} style={{ flex: '1 1 420px', minWidth: 320 }}>
          {/* Etiqueta fija de region (ticket 011, alternativa elegida sobre
              un tooltip flotante -- ver docs/ARQUITECTURA.md): se actualiza
              en vivo con cada `pointermove` sobre el canvas de textura
              (`onHoverPixel`, `TextureEditor.tsx`) y vuelve a "--" al salir
              del canvas o cuando el pixel cae en una zona de relleno sin
              region UV conocida (ver `regionLabels.ts`). */}
          <p
            aria-live="polite"
            style={{
              margin: '0 0 8px',
              fontSize: 12,
              color: 'var(--text-dim)',
              minHeight: 16,
            }}
          >
            Región: <strong style={{ color: 'var(--text)' }}>{hoveredRegion?.label ?? '—'}</strong>
          </p>
          {/* Aviso de bloqueo de pintado (ticket 012, criterio "nunca
              fallo silencioso"): aparece cuando el ultimo intento de
              pintado (click/brocha) toco al menos un pixel fuera de la
              parte aislada activa -- ver `applyPixelsWithSymmetry`. Se
              suma a la señal visual continua (atenuado + cursor
              `not-allowed`, `TextureEditor.tsx`), no la reemplaza. */}
          {isolatedRegion && paintBlockedByIsolation && (
            <p
              role="status"
              aria-live="polite"
              style={{
                margin: '0 0 8px',
                fontSize: 12,
                color: 'var(--text)',
                background: 'rgba(255, 214, 89, 0.15)',
                border: '1px solid rgba(255, 214, 89, 0.5)',
                borderRadius: 4,
                padding: '4px 8px',
              }}
            >
              Pintura bloqueada: ese pixel esta fuera de la parte aislada ({isolatedRegion.label}).
            </p>
          )}
          {/* Contenedor con scroll horizontal (ticket 010): si el canvas
              (textureWidth*zoom, ver `canvasSize.ts`) no cabe en el
              ancho disponible del panel, este `<div>` scrollea en X en
              vez de dejar que el canvas se comprima/deforme -- nunca se
              usa `max-width`/`width: 100%` sobre el canvas en si (ver
              `TextureEditor.tsx`). */}
          <div ref={textureSectionWrapperRef} style={{ maxWidth: '100%', overflowX: 'auto' }}>
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
                namedRegions={namedRegions}
                onHoverPixel={handleHoverPixel}
                isolatedRegion={isolatedRegion}
                forcedRgba={paintMode === 'erase' ? ERASE_RGBA : undefined}
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
          </div>
          {textureOverflowsPanel && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
              El editor no cabe en el ancho actual del panel -- desplázate horizontalmente para ver el resto.
            </p>
          )}
        </Section>

        {/* Columna derecha (ticket 072): visor 3D reducido a "Vista
            previa" + "Parte enfocada" (mismo `PartIsolationControls`,
            re-etiquetado) + "Información de la textura" (nueva, datos ya
            derivados sin storage nuevo) + "Archivo" (Importar/Pegar --
            NO estaba en la imagen de referencia de Marco, pero se
            conserva aca para no quitar funcionalidad existente en
            silencio, ver regla 8 de CLAUDE.md) + "Consejo". La
            resolución de trabajo vive ahora en la barra de herramientas
            (corrección de Marco), no en esta columna. */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Section title="Vista previa 3D">
            <div
              ref={viewerWrapperRef}
              style={{
                position: 'relative',
                width: isFullscreen ? '100vw' : '100%',
                height: isFullscreen ? '100vh' : 220,
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'var(--bg)',
              }}
            >
              <Viewer3D key={viewerKey} texture={texture} geometry={geometry} mobLabel={mobLabel} />
              {initError && (
                <p
                  role="alert"
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    right: 8,
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
              {/* "Rotar"/"Zoom"/"Mover" de la imagen de referencia son
                  gestos del mouse que `OrbitControls` (drei) ya maneja
                  nativamente sobre el visor -- se muestran como texto
                  informativo, NO como botones (no hay una acción
                  discreta que disparar para "rotar", es un arrastre
                  continuo) -- decisión a disclosear a Marco. */}
              <p title="Arrastra para rotar, rueda del mouse para zoom, click derecho + arrastrar para mover la cámara" style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                Rotar · Zoom · Mover — con el mouse
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button variant="icon-square" title="Restablecer cámara" onClick={handleResetViewer}>
                  <IconRefresh size={16} />
                </Button>
                <Button variant="icon-square" title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} onClick={handleToggleFullscreen}>
                  <IconExpand size={16} />
                </Button>
              </div>
            </div>
          </Section>

          <Section title="Parte enfocada">
            {/* Selector de partes (ticket 012) -- reusa `namedRegions`
                (catalogo del ticket 011) tal cual, sin redefinirlo. Ver
                `PartIsolationControls.tsx`/`partIsolation.ts` para la
                decision de granularidad (una region = una cara, no la caja
                completa) y docs/ARQUITECTURA.md, "Ticket 012". */}
            <PartIsolationControls regions={namedRegions} activeRegionId={isolatedRegionId} onSelect={handleSelectIsolatedPart} />
          </Section>

          <Section title="Información de la textura">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)', color: 'var(--text)', background: 'var(--chip-bg)', borderRadius: 10, padding: '6px 10px' }}>
                <IconMaximize size={14} /> {buffer.width}×{buffer.height} px
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)', color: 'var(--text)', background: 'var(--chip-bg)', borderRadius: 10, padding: '6px 10px' }}>
                <IconScale size={14} /> Escala: x{resolution}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)', color: 'var(--text)', background: 'var(--chip-bg)', borderRadius: 10, padding: '6px 10px' }}>
                <IconDocument size={14} /> {mobId}.png
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)', color: 'var(--text)', background: 'var(--chip-bg)', borderRadius: 10, padding: '6px 10px' }}>
                <IconModel size={14} /> {mobLabel}
              </span>
            </div>
          </Section>

          {/* Corrección de Marco (revisión en vivo del ticket 072): la
              resolución de trabajo ya NO vive aca -- se movió al slot
              "Resolución" de la barra de herramientas (ver mas arriba).
              Este panel queda solo con "Importar"/"Pegar" (ticket 031,
              HU-6) -- "Exportar PNG" se promovió a la fila de título
              (`ExportControls` de arriba). No estaba en la imagen de
              referencia de Marco, pero se conserva para no quitar esta
              funcionalidad existente en silencio (regla 8 de CLAUDE.md). */}
          <Section title="Archivo">
            <Menu
              label={
                <>
                  <span aria-hidden="true">📁</span> Importar / pegar imagen
                </>
              }
              items={[]}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 8, minWidth: 220 }}>
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
              </div>
            </Menu>
          </Section>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 'var(--radius-lg)', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-strong)' }}>
            <IconLightbulb size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--text)' }}>
              <strong>Consejo:</strong> activa "Simetría" para pintar ambos lados de una parte a la vez, o aísla una parte en "Parte enfocada" para no salirte de sus límites mientras pintas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
