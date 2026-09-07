import { useCallback, useEffect, useState } from 'react';
import { Button, Menu } from '../ui';
import { IconDocument, IconDots, IconEye, IconMaximize, IconModel, IconPencil, IconScale, IconTrash, IconX } from '../ui/icons';
import { fetchMobBaseAssets } from '../api/baseAssets';
import { useMobSnapshot3D } from '../hooks/useMobSnapshot3D';
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
 * agrandar una miniatura nativa chica. `width`/`height` sí fuerzan el
 * tamaño de caja, y `objectFit: 'contain'` mantiene la proporción real
 * sin deformar -- ahora sí escala hacia arriba.
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
function MobPreviewModal({ label, snapshotUrl, onClose }: { label: string; snapshotUrl: string | null; onClose: () => void }) {
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
        <div style={{ width: 340, height: 340, display: 'grid', placeItems: 'center', background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
          {snapshotUrl ? (
            // Una sola línea -- ver `ProjectCard.tsx` (ticket 053) para el hallazgo real de por qué (bug de `ui-accessibility-guard.sh` con tags multilínea, reportado via `SendFeedback`).
            <img src={snapshotUrl} alt={`Vista previa ampliada de ${label}`} style={{ width: 310, height: 310, objectFit: 'contain', imageRendering: 'pixelated' }} />
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
 * referencia con un proyecto real de Marco). Modo grid (ticket 069):
 * nombre + menú "⋮" arriba, miniatura debajo a todo el ancho, info
 * debajo de esa. Modo lista (ticket 068): miniatura chica + nombre en
 * una sola fila, sin info detallada (deformaba la fila angosta).
 * Miniatura con la textura del proyecto aplicada al modelo 3D real,
 * fotografiada en un ángulo fijo estilo "wiki oficial" (motor del
 * ticket 062, ver `renderMobSnapshot3D.ts` -- reemplaza al compositor
 * 2D plano del ticket 055/058, retirado), info derivada (archivo/
 * dimensiones/escala/modelo, sin storage nuevo), un ícono de ojo
 * compacto + "Editar textura", y un menú "⋮" con "Eliminar mob del
 * proyecto" (confirmación inline, ticket 058).
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

  const snapshotUrl = useMobSnapshot3D(geometry, pngDataUrl);
  const handleOpenPreview = useCallback(() => setShowPreview(true), []);
  const handleClosePreview = useCallback(() => setShowPreview(false), []);
  const handleConfirmRemove = useCallback(() => {
    setConfirmRemove(false);
    onRemoveMob();
  }, [onRemoveMob]);

  const isList = layout === 'list';
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

  // Ticket 069 (pedido de Marco, con imagen de referencia): en modo
  // grid la miniatura deja de ser un cuadro chico de 160px a un lado
  // del nombre -- pasa a ocupar TODO el ancho de la tarjeta, debajo
  // del nombre (ver el `return` de más abajo). En modo lista sigue
  // siendo el cuadrito chico de 40px junto al nombre (ticket 057/068,
  // sin cambios ahí). Una sola línea -- ver `ProjectCard.tsx` (ticket
  // 053) para el hallazgo real de por qué (bug de
  // `ui-accessibility-guard.sh` con tags multilínea, reportado via
  // `SendFeedback`).
  const thumb = isList ? (
    <img src={snapshotUrl ?? pngDataUrl} alt={`Miniatura de la textura guardada de ${label}`} style={{ width: 40, height: 40, objectFit: 'contain', imageRendering: 'pixelated', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
  ) : (
    <img src={snapshotUrl ?? pngDataUrl} alt={`Miniatura de la textura guardada de ${label}`} style={{ width: '100%', height: 200, objectFit: 'contain', imageRendering: 'pixelated', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }} />
  );

  // Ticket 059 (corrección de Marco: "te falta agregar iconos") -- cada
  // línea de info gana un ícono a la izquierda (`ui/icons.tsx`, mismo
  // criterio hand-drawn del ticket 046, sin emoji).
  const infoRows: Array<{ Icon: typeof IconDocument; text: string }> = [
    { Icon: IconDocument, text: vanillaFileName(mobId) },
    { Icon: IconMaximize, text: dimensions },
    { Icon: IconScale, text: `Escala: x${resolution}` },
    { Icon: IconModel, text: `Modelo: ${label}` },
  ];

  // Ticket 066 (pedido de Marco: "los textos... estan muy juntos,
  // espacialos mas") -- gap de 4 a 7 entre cada línea de info.
  const info = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
      {infoRows.map(({ Icon, text }) => (
        <span key={text} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={13} style={{ flexShrink: 0 }} />
          {text}
        </span>
      ))}
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
      // Ticket 068 (pedido de Marco: "quita el texto que detalla la
      // textura pues deforma el elemento... solo deja el nombre") --
      // sin `{info}` (archivo/dimensiones/escala/modelo) en modo
      // lista, la fila es angosta y ese bloque de 4 líneas la
      // deformaba. En modo grid sigue igual -- ahí sí hay espacio.
      <li style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
        {thumb}
        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 'var(--font-sm)' }}>{label}</span>
        {editButton}
        {eyeButton}
        {menu}
        {showPreview && <MobPreviewModal label={label} snapshotUrl={snapshotUrl} onClose={handleClosePreview} />}
      </li>
    );
  }

  return (
    // Ticket 069 (pedido de Marco, con imagen de referencia): el
    // nombre + el menú "⋮" pasan a ser la fila de hasta arriba de la
    // tarjeta (antes: miniatura a la izquierda, nombre+menú+info a la
    // derecha, ticket 059) -- nombre a la izquierda, menú a la
    // derecha, ambos centrados verticalmente en su fila
    // (`alignItems: 'center'`). Debajo, la miniatura ocupa todo el
    // ancho, y debajo de esa la info. `gap` de 14 a 18 -- "los textos
    // dentro de la card deven verse mas espaciados".
    <li style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--font-md)' }}>{label}</span>
        {menu}
      </div>
      {thumb}
      {info}
      <div style={{ display: 'flex', gap: 8 }}>
        {editButton}
        {eyeButton}
      </div>
      {showPreview && <MobPreviewModal label={label} snapshotUrl={snapshotUrl} onClose={handleClosePreview} />}
    </li>
  );
}
