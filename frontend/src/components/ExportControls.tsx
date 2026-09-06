import { useCallback, useState } from 'react';
import type { TextureBuffer } from '../textureBuffer';
import { exportResourcePackZip, exportTexturePng } from '../export';
import type { UVBoxRect } from '../symmetry';
import { Button, InlineError } from '../ui';

export interface ExportControlsProps {
  buffer: TextureBuffer;
  /**
   * Cajas UV conocidas, YA escaladas a la resolucion de trabajo activa
   * (`computeUVBoxRects(geometry, resolution)`, ver `Editor.tsx`) --
   * ticket 015: se pasan tal cual a `export.ts` para forzar alpha=0
   * fuera de ellas al exportar (mitigacion del bug "hat overlay
   * contaminado en export"), sin recalcularlas aca.
   */
  uvBoxes: UVBoxRect[];
}

/**
 * Botones "Exportar PNG" (HU-10) y "Exportar pack (.zip)" (HU-11) --
 * ticket 006. Ambos leen el `TextureBuffer` compartido en el momento
 * del click. `disabled` mientras la exportación en curso está en vuelo
 * evita disparar una segunda descarga con un doble click.
 *
 * Ticket 026: migrado a `Button`+`InlineError` (`ui/`).
 */
export function ExportControls({ buffer, uvBoxes }: ExportControlsProps) {
  const [pending, setPending] = useState<'png' | 'zip' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExportPng = useCallback(async () => {
    setError(null);
    setPending('png');
    try {
      await exportTexturePng(buffer, uvBoxes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el PNG.');
    } finally {
      setPending(null);
    }
  }, [buffer, uvBoxes]);

  const handleExportZip = useCallback(async () => {
    setError(null);
    setPending('zip');
    try {
      await exportResourcePackZip(buffer, uvBoxes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el resource pack.');
    } finally {
      setPending(null);
    }
  }, [buffer, uvBoxes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Button onClick={() => void handleExportPng()} disabled={pending !== null}>
        {pending === 'png' ? 'Exportando PNG…' : 'Exportar PNG'}
      </Button>
      <Button onClick={() => void handleExportZip()} disabled={pending !== null}>
        {pending === 'zip' ? 'Exportando pack…' : 'Exportar pack (.zip)'}
      </Button>
      {error && <InlineError message={error} />}
    </div>
  );
}
