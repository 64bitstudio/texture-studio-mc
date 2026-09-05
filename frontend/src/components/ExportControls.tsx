import { useCallback, useState } from 'react';
import type { TextureBuffer } from '../textureBuffer';
import { exportResourcePackZip, exportTexturePng } from '../export';

export interface ExportControlsProps {
  buffer: TextureBuffer;
}

/**
 * Botones "Exportar PNG" (HU-10) y "Exportar pack (.zip)" (HU-11) --
 * ticket 006. Ambos leen el `TextureBuffer` compartido en el momento
 * del click (mismo patron que el resto de escrituras/lecturas de
 * `Editor.tsx`) -- no mantienen una copia propia de los pixeles, asi
 * que funcionan igual sin importar si el contenido actual vino de
 * pintar a mano, de importar un PNG (ticket 005, HU-8) o de pegar una
 * imagen (ticket 005, HU-9). `disabled` mientras la exportacion en
 * curso esta en vuelo evita disparar una segunda descarga con un doble
 * click (la codificacion PNG/ZIP es rapida pero asincrona).
 */
export function ExportControls({ buffer }: ExportControlsProps) {
  const [pending, setPending] = useState<'png' | 'zip' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExportPng = useCallback(async () => {
    setError(null);
    setPending('png');
    try {
      await exportTexturePng(buffer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el PNG.');
    } finally {
      setPending(null);
    }
  }, [buffer]);

  const handleExportZip = useCallback(async () => {
    setError(null);
    setPending('zip');
    try {
      await exportResourcePackZip(buffer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el resource pack.');
    } finally {
      setPending(null);
    }
  }, [buffer]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        onClick={() => void handleExportPng()}
        disabled={pending !== null}
        style={{
          padding: '8px 10px',
          fontSize: 13,
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.25)',
          background: 'var(--panel-bg)',
          color: 'var(--text)',
          cursor: pending === null ? 'pointer' : 'not-allowed',
          opacity: pending === null ? 1 : 0.5,
        }}
      >
        {pending === 'png' ? 'Exportando PNG…' : 'Exportar PNG'}
      </button>
      <button
        type="button"
        onClick={() => void handleExportZip()}
        disabled={pending !== null}
        style={{
          padding: '8px 10px',
          fontSize: 13,
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.25)',
          background: 'var(--panel-bg)',
          color: 'var(--text)',
          cursor: pending === null ? 'pointer' : 'not-allowed',
          opacity: pending === null ? 1 : 0.5,
        }}
      >
        {pending === 'zip' ? 'Exportando pack…' : 'Exportar pack (.zip)'}
      </button>
      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            padding: '6px 8px',
            fontSize: 12,
            color: 'var(--text)',
            background: 'rgba(200, 60, 60, 0.25)',
            borderRadius: 4,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
