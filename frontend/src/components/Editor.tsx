import { useCallback, useEffect, useState } from 'react';
import { Viewer3D } from './Viewer3D';
import { TextureEditor } from './TextureEditor';
import { ColorPicker } from './ColorPicker';
import { decodePngDataUrlToImageData } from '../decodeTexture';
import { useCanvasTexture } from '../hooks/useCanvasTexture';
import { TextureBuffer, type PixelPoint, type RGBA } from '../textureBuffer';
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

  const setPixel = useCallback(
    (x: number, y: number, rgba: RGBA) => {
      if (buffer.setPixel(x, y, rgba)) setVersion((v) => v + 1);
    },
    [buffer],
  );

  const paintLine = useCallback(
    (from: PixelPoint, to: PixelPoint, rgba: RGBA) => {
      const painted = buffer.paintLine(from.x, from.y, to.x, to.y, rgba);
      if (painted.length > 0) setVersion((v) => v + 1);
    },
    [buffer],
  );

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
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-dim)' }}>Color</h2>
          <ColorPicker color={color} onChange={setColor} />
        </section>

        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-dim)' }}>
            Textura ({buffer.width}×{buffer.height})
          </h2>
          <TextureEditor buffer={buffer} version={version} color={color} onSetPixel={setPixel} onPaintLine={paintLine} />
        </section>
      </aside>
    </div>
  );
}
