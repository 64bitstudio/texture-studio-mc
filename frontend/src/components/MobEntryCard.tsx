import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui';
import { IconEye, IconPencil, IconX } from '../ui/icons';
import { fetchMobBaseAssets } from '../api/baseAssets';
import { useMobFrontSprite2D } from '../hooks/useMobFrontSprite2D';
import type { MobGeometry } from '../types/baseAssets';
import type { ToggleLayout } from '../ui';

export interface MobEntryCardProps {
  mobId: string;
  label: string;
  pngDataUrl: string;
  resolution: number;
  layout: ToggleLayout;
  /** Cache de geometrías COMPARTIDA entre todas las tarjetas de esta pantalla -- mismo criterio ya establecido en el ticket 055 (`Proyecto.tsx`, `MobThumbnail2D`, retirado en este ticket a favor de esta tarjeta). */
  geometryCache: Map<string, MobGeometry>;
  /** "Editar textura" -- mismo `onSelectMob` que ya usa `Proyecto.tsx`, navega al editor actual SIN NINGÚN CAMBIO (confirmado explícito con Marco). */
  onEditTexture: () => void;
}

/** Nombre de archivo vanilla de la textura de un mob -- mismo convenio ya usado por `exportPack.ts` (`entityTexturePngPath`), solo el nombre del archivo (no la ruta completa dentro del ZIP). */
function vanillaFileName(mobId: string): string {
  return `${mobId}.png`;
}

/**
 * Modal de preview ampliado (ícono de ojo, ticket 057) -- overlay propio
 * en el DOM, sin diálogo nativo del navegador (mismo criterio que el
 * resto de la app, ver memoria `texture-studio-mc-sin-dialogos-nativos`).
 * Cierra con Escape, click afuera, o el botón "Cerrar".
 */
function MobPreviewModal({ label, spriteUrl, onClose }: { label: string; spriteUrl: string | null; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa de ${label}`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', display: 'grid', placeItems: 'center', zIndex: 100 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 260 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-lg)' }}>{label}</h3>
          <Button variant="icon-square" onClick={onClose} title="Cerrar">
            <IconX size={16} />
            <span className="sr-only">Cerrar vista previa</span>
          </Button>
        </div>
        <div style={{ width: 256, height: 256, display: 'grid', placeItems: 'center', background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
          {spriteUrl ? (
            // Una sola línea -- ver `ProjectCard.tsx` (ticket 053) para el hallazgo real de por qué (bug de `ui-accessibility-guard.sh` con tags multilínea, reportado via `SendFeedback`).
            <img src={spriteUrl} alt={`Vista previa ampliada de ${label}`} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', imageRendering: 'pixelated' }} />
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-dim)' }}>Generando vista previa…</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Tarjeta de un mob dentro de "Proyecto" (ticket 057) -- reemplaza el
 * grid simple del ticket 041 (imagen cruda + nombre, toda la tarjeta
 * clicable) por una tarjeta real: miniatura 2D (motor del ticket 055),
 * info derivada (archivo/dimensiones/escala, sin storage nuevo, ver
 * `docs/definiciones/preview-2d-y-rediseno-proyecto.md`), botón "Editar
 * textura" y un ícono de ojo con preview ampliado.
 *
 * Geometría propia (no recibida por props) -- mismo patrón ya
 * establecido en el ticket 055 (`MobThumbnail2D`, retirado en este
 * ticket a favor de esta tarjeta): se deriva del `geometryCache`
 * compartido durante el render cuando ya está cacheada, y se dispara un
 * fetch solo la primera vez que un tipo de mob aparece en pantalla.
 */
export function MobEntryCard({ mobId, label, pngDataUrl, resolution, layout, geometryCache, onEditTexture }: MobEntryCardProps) {
  const cachedGeometry = geometryCache.get(mobId) ?? null;
  const [fetchedGeometry, setFetchedGeometry] = useState<MobGeometry | null>(null);
  const geometry = cachedGeometry ?? fetchedGeometry;
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (geometryCache.has(mobId)) return;
    let cancelled = false;
    fetchMobBaseAssets(mobId)
      .then((asset) => {
        geometryCache.set(mobId, asset.geometry);
        if (!cancelled) setFetchedGeometry(asset.geometry);
      })
      .catch((err: unknown) => {
        console.warn(`MobEntryCard: no se pudo cargar la geometría de "${mobId}".`, err);
      });
    return () => {
      cancelled = true;
    };
  }, [mobId, geometryCache]);

  const spriteUrl = useMobFrontSprite2D(geometry, pngDataUrl, resolution);
  const handleOpenPreview = useCallback(() => setShowPreview(true), []);
  const handleClosePreview = useCallback(() => setShowPreview(false), []);

  const isList = layout === 'list';
  const thumbSize = isList ? 40 : 56;
  const dimensions = geometry ? `${geometry.textureWidth * resolution}×${geometry.textureHeight * resolution} px` : '—';

  const thumb = (
    // Una sola línea -- ver `ProjectCard.tsx` (ticket 053) para el hallazgo real de por qué (bug de `ui-accessibility-guard.sh` con tags multilínea, reportado via `SendFeedback`).
    <img src={spriteUrl ?? pngDataUrl} alt={`Miniatura de la textura guardada de ${label}`} style={{ width: thumbSize, height: thumbSize, objectFit: 'contain', imageRendering: 'pixelated', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
  );

  const info = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
        {vanillaFileName(mobId)} · {dimensions} · x{resolution}
      </span>
    </div>
  );

  const actions = (
    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <Button onClick={handleOpenPreview} title={`Ver ${label} en grande`}>
        <IconEye size={16} />
        {!isList && 'Vista previa'}
        <span className="sr-only">Vista previa ampliada de {label}</span>
      </Button>
      <Button variant="primary" onClick={onEditTexture}>
        <IconPencil size={16} /> Editar textura
      </Button>
    </div>
  );

  if (isList) {
    return (
      <li style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
        {thumb}
        <div style={{ flex: 1, minWidth: 0 }}>{info}</div>
        {actions}
        {showPreview && <MobPreviewModal label={label} spriteUrl={spriteUrl} onClose={handleClosePreview} />}
      </li>
    );
  }

  return (
    <li style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {thumb}
        {info}
      </div>
      {actions}
      {showPreview && <MobPreviewModal label={label} spriteUrl={spriteUrl} onClose={handleClosePreview} />}
    </li>
  );
}
