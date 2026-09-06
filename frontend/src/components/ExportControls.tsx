import { useCallback, useState } from 'react';
import type { TextureBuffer } from '../textureBuffer';
import { exportTexturePng } from '../export';
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
 * Boton "Exportar PNG" (HU-10) -- ticket 006. Lee el `TextureBuffer`
 * compartido en el momento del click. `disabled` mientras la
 * exportación en curso está en vuelo evita disparar una segunda
 * descarga con un doble click.
 *
 * Ticket 026: migrado a `Button`+`InlineError` (`ui/`).
 *
 * Ticket 044 (HU-4): se retiro el boton "Exportar pack (.zip)" que
 * vivia aca (exportaba SOLO el mob activo del editor,
 * `exportResourcePackZip`) -- reemplazado por "Exportar proyecto
 * (.zip)" en `Proyecto.tsx` (`exportProjectZip`, itera TODOS los mobs
 * del proyecto). Cambio de comportamiento intencional, ya señalado en
 * el documento de definición -- no coexisten ambas opciones (ver
 * `docs/ARQUITECTURA.md`, "Ticket 044"). "Exportar PNG" (HU-10, un
 * solo archivo suelto del mob activo, sin empaquetar) no forma parte
 * de este cambio y sigue viviendo aca sin modificaciones.
 */
export function ExportControls({ buffer, uvBoxes }: ExportControlsProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExportPng = useCallback(async () => {
    setError(null);
    setPending(true);
    try {
      await exportTexturePng(buffer, uvBoxes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el PNG.');
    } finally {
      setPending(false);
    }
  }, [buffer, uvBoxes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Button onClick={() => void handleExportPng()} disabled={pending}>
        {pending ? 'Exportando PNG…' : 'Exportar PNG'}
      </Button>
      {error && <InlineError message={error} />}
    </div>
  );
}
