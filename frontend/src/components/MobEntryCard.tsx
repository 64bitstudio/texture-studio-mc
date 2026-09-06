import { useCallback, useEffect, useState } from 'react';
import { Button, Menu } from '../ui';
import { IconDots, IconEye, IconPencil, IconTrash, IconX } from '../ui/icons';
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
  /** Cache de geometrías COMPARTIDA entre todas las tarjetas de esta pantalla -- mismo criterio ya establecido en el ticket 055 (`Proyecto.tsx`, `MobThumbnail2D`, retirado en el ticket 057). */
  geometryCache: Map<string, MobGeometry>;
  /** "Editar textura" -- mismo `onSelectMob` que ya usa `Proyecto.tsx`, navega al editor actual SIN NINGÚN CAMBIO (confirmado explícito con Marco). */
  onEditTexture: () => void;
  /** Menú "⋮" -> "Eliminar mob del proyecto" (ticket 058) -- confirmado con inline, sin diálogo nativo. El padre (`Proyecto.tsx`) hace la escritura real (`removeMobFromProject`) y refresca la lista. */
  onRemoveMob: () => void;
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
 *
 * Ticket 058 (hallazgo real #1, bug de Marco): la imagen usaba
 * `maxWidth`/`maxHeight`, que solo LIMITAN el tamaño -- nunca fuerzan a
 * agrandar un sprite nativo chico (un proyecto x1 produce un sprite de
 * ~20x35px reales, que se veía diminuto dentro de la caja de 256x256).
 * `width`/`height` sí fuerzan el tamaño de caja, y `objectFit: 'contain'`
 * mantiene la proporción real sin deformar -- ahora sí escala hacia
 * arriba.
 *
 * Ticket 058 (hallazgo real #2, encontrado verificando el fix de
 * arriba): `width`/`height` en PORCENTAJE (`'90%'`) no resuelven contra
 * un padre `display: grid` con `placeItems: 'center'` de forma
 * confiable -- el ancho sí tomaba el 90% real, pero el alto terminaba
 * calculado a partir de la proporción intrínseca de la imagen en vez
 * del 90% del contenedor (verificado con `getBoundingClientRect` --el
 * alto real no coincidía con `256 * 0.9`), y el sprite se salía de la
 * caja. Fix: valores fijos en píxeles (`230`, no `'90%'`) -- sin
 * porcentaje que resolver, sin ambigüedad.
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
            <img src={spriteUrl} alt={`Vista previa ampliada de ${label}`} style={{ width: 230, height: 230, objectFit: 'contain', imageRendering: 'pixelated' }} />
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-dim)' }}>Generando vista previa…</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Tarjeta de un mob dentro de "Proyecto" (ticket 057, ajustada de
 * fidelidad visual en el ticket 058 tras comparar contra la imagen de
 * referencia con un proyecto real de Marco): miniatura 2D grande (motor
 * del ticket 055, corregido en el 058 para no perder detalle en
 * texturas de alta resolución -- ver `renderMobFrontSprite2D.ts`), info
 * derivada (archivo/dimensiones/escala/modelo, sin storage nuevo), un
 * ícono de ojo compacto + "Editar textura", y un menú "⋮" con "Eliminar
 * mob del proyecto" (confirmación inline, ticket 058).
 */
export function MobEntryCard({ mobId, label, pngDataUrl, resolution, layout, geometryCache, onEditTexture, onRemoveMob }: MobEntryCardProps) {
  const cachedGeometry = geometryCache.get(mobId) ?? null;
  const [fetchedGeometry, setFetchedGeometry] = useState<MobGeometry | null>(null);
  const geometry = cachedGeometry ?? fetchedGeometry;
  const [showPreview, setShowPreview] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

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
  const handleConfirmRemove = useCallback(() => {
    setConfirmRemove(false);
    onRemoveMob();
  }, [onRemoveMob]);

  const isList = layout === 'list';
  const thumbSize = isList ? 40 : 140;
  const dimensions = geometry ? `${geometry.textureWidth * resolution}×${geometry.textureHeight * resolution} px` : '—';

  const menu = (
    <Menu
      triggerVariant="icon-square"
      label={
        <>
          <IconDots size={18} />
          <span className="sr-only">Acciones del mob «{label}»</span>
        </>
      }
      items={[]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 4, minWidth: 200 }} onClick={(e) => e.stopPropagation()}>
        {confirmRemove ? (
          <div role="alertdialog" aria-label={`Confirmar eliminación de ${label} del proyecto`} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 6px' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-sm)' }}>¿Quitar «{label}» de este proyecto?</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="danger" onClick={handleConfirmRemove} style={{ flex: 1, justifyContent: 'center' }}>
                Sí, quitar
              </Button>
              <Button onClick={() => setConfirmRemove(false)} style={{ flex: 1, justifyContent: 'center' }}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" className="ui-menu__item" style={{ color: 'var(--danger)' }} onClick={() => setConfirmRemove(true)}>
            <IconTrash size={16} /> Eliminar mob del proyecto
          </button>
        )}
      </div>
    </Menu>
  );

  // Una sola línea -- ver `ProjectCard.tsx` (ticket 053) para el hallazgo real de por qué (bug de `ui-accessibility-guard.sh` con tags multilínea, reportado via `SendFeedback`).
  const thumb = <img src={spriteUrl ?? pngDataUrl} alt={`Miniatura de la textura guardada de ${label}`} style={{ width: thumbSize, height: thumbSize, objectFit: 'contain', imageRendering: 'pixelated', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', flexShrink: 0 }} />;

  const info = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
      <span>{vanillaFileName(mobId)}</span>
      <span>{dimensions}</span>
      <span>Escala: x{resolution}</span>
      <span>Modelo: {label}</span>
    </div>
  );

  const eyeButton = (
    <Button variant="icon-square" onClick={handleOpenPreview} title={`Ver ${label} en grande`}>
      <IconEye size={16} />
      <span className="sr-only">Vista previa ampliada de {label}</span>
    </Button>
  );

  const editButton = (
    <Button variant="primary" onClick={onEditTexture} style={{ flex: 1, justifyContent: 'center' }}>
      <IconPencil size={16} /> Editar textura
    </Button>
  );

  if (isList) {
    return (
      <li style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
        {thumb}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)', display: 'block', marginBottom: 2 }}>{label}</span>
          {info}
        </div>
        {eyeButton}
        {editButton}
        {menu}
        {showPreview && <MobPreviewModal label={label} spriteUrl={spriteUrl} onClose={handleClosePreview} />}
      </li>
    );
  }

  return (
    <li style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{label}</span>
        {menu}
      </div>
      {info}
      <div style={{ display: 'flex', justifyContent: 'center' }}>{thumb}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {eyeButton}
        {editButton}
      </div>
      {showPreview && <MobPreviewModal label={label} spriteUrl={spriteUrl} onClose={handleClosePreview} />}
    </li>
  );
}
