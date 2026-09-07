import { useCallback, useEffect, useState } from 'react';
import { Button, Menu } from '../ui';
import { IconDocument, IconDots, IconEye, IconMaximize, IconModel, IconPencil, IconScale, IconTrash, IconX } from '../ui/icons';
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
        <div style={{ width: 340, height: 340, display: 'grid', placeItems: 'center', background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
          {spriteUrl ? (
            // Una sola línea -- ver `ProjectCard.tsx` (ticket 053) para el hallazgo real de por qué (bug de `ui-accessibility-guard.sh` con tags multilínea, reportado via `SendFeedback`).
            <img src={spriteUrl} alt={`Vista previa ampliada de ${label}`} style={{ width: 310, height: 310, objectFit: 'contain', imageRendering: 'pixelated' }} />
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
  // Ticket 060 (corrección de Marco: "las cards deben ser mas grandes y
  // tambien los renders 2D de cada textura") -- en grid, la miniatura
  // crece de 96 a 160 y la tarjeta completa gana padding/gaps a juego
  // (ver el `<li>` de abajo). En modo lista se deja igual: ahí la fila
  // es angosta y compacta por diseño (ticket 057).
  const thumbSize = isList ? 40 : 160;
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

  // Ticket 059 (corrección de Marco: "te falta agregar iconos") -- cada
  // línea de info gana un ícono a la izquierda (`ui/icons.tsx`, mismo
  // criterio hand-drawn del ticket 046, sin emoji).
  const infoRows: Array<{ Icon: typeof IconDocument; text: string }> = [
    { Icon: IconDocument, text: vanillaFileName(mobId) },
    { Icon: IconMaximize, text: dimensions },
    { Icon: IconScale, text: `Escala: x${resolution}` },
    { Icon: IconModel, text: `Modelo: ${label}` },
  ];

  const info = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
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
      <li style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
        {thumb}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)', display: 'block', marginBottom: 2 }}>{label}</span>
          {info}
        </div>
        {editButton}
        {eyeButton}
        {menu}
        {showPreview && <MobPreviewModal label={label} spriteUrl={spriteUrl} onClose={handleClosePreview} />}
      </li>
    );
  }

  return (
    <li style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
      {/* Ticket 059 (corrección de Marco: "la card... debe estar de
          lado izquierdo la imagen del mob y del lado derecho el
          detalle") -- miniatura a la izquierda, nombre+menú+info a la
          derecha, en vez de nombre arriba y la miniatura grande
          centrada debajo. Ticket 060: tarjeta y miniatura más grandes
          (ver `thumbSize` y el padding/gap del `<li>` de arriba). */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {thumb}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Ticket 061 (corrección de Marco): el nombre va pegado
              hasta arriba de la tarjeta (ya lo estaba -- primer
              elemento de la columna, `alignItems: 'flex-start'` en la
              fila de arriba) y un poco más grande (`--font-sm` ->
              `--font-md`). */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--font-md)' }}>{label}</span>
            {menu}
          </div>
          {info}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {editButton}
        {eyeButton}
      </div>
      {showPreview && <MobPreviewModal label={label} spriteUrl={spriteUrl} onClose={handleClosePreview} />}
    </li>
  );
}
