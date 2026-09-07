import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Button, InlineError } from '../ui';
import { IconSearch, IconX } from '../ui/icons';
import { fetchMobBaseAssets } from '../api/baseAssets';
import { decodePngDataUrlToImageData } from '../decodeTexture';
import { TextureBuffer } from '../textureBuffer';
import { buildProjectSnapshot } from '../projectSnapshot';
import { loadProject, saveProject } from '../projectStorage';
import { MOB_DESCRIPTIONS, MOB_ICONS } from '../mobIcons';
import type { MobSummary } from '../types/mobs';
import type { MobBaseAssetsResponse } from '../types/baseAssets';

export interface AgregarMobModalProps {
  projectName: string;
  mobs: MobSummary[];
  /** El proyecto ya lleva estos mobs -- NO aparecen seleccionables (mismo criterio estructural que ya tenía `AgregarMobs.tsx`, ticket 042: un proyecto no puede tener dos texturas del mismo mob). */
  existingMobIds: string[];
  /** Se llama tras agregar con éxito, con el id del mob que se sumó. `App.tsx` actualiza `activeProject.mobIds` y cierra el modal. */
  onMobAdded: (mobId: string) => void;
  onCancel: () => void;
}

/**
 * Modal "Agregar mob al proyecto" (ticket 071, pedido de Marco con
 * imagen de referencia) -- reemplaza a la pantalla completa
 * `AgregarMobs.tsx` (ticket 042, retirada en este ticket). Confirmado
 * con Marco vía `AskUserQuestion` antes de implementar: SOLO el modal,
 * con el catálogo actual de 4 mobs (Esqueleto/Zombie/Araña/Creeper) --
 * el catálogo extendido de la imagen de referencia (categorías
 * Hostiles/Pasivos/Neutrales/etc., ~60 mobs) queda fuera de alcance,
 * cada mob nuevo requiere investigar su geometría oficial y verificarla
 * pixel a pixel (ver memoria `texture-studio-mc-metodologia-mobs`), no
 * es un cambio chico.
 *
 * Cambios de interacción respecto a `AgregarMobs.tsx` (señalados
 * explícitamente a Marco al pedir su VoBo, no asumidos en silencio):
 * - Selección de UN mob a la vez (la imagen de referencia muestra un
 *   solo mob resaltado + un botón "Agregar mob" singular), no selección
 *   múltiple con contador.
 * - Sin visor 3D en vivo -- el panel del mob seleccionado muestra su
 *   ícono oficial + descripción corta (`mobIcons.ts`, ya usado en
 *   "Nuevo proyecto") + resolución/modelo derivados de su geometría,
 *   igual que la imagen de referencia.
 * - Sin barra lateral de categorías -- con solo 4 mobs (los 4 son
 *   "Hostiles" en la clasificación vanilla) una barra de categorías
 *   sería principalmente vacía/engañosa; se deja para cuando haya
 *   catálogo real que categorizar.
 *
 * Cada mob agregado arranca con la MISMA textura base
 * (vanilla/placeholder) que ya usa `NuevoProyecto.tsx`/`Editor.tsx` al
 * abrir un mob por primera vez -- mismo punto de partida, sin inventar
 * un segundo "blanco" distinto (mismo criterio ya establecido).
 */
export function AgregarMobModal({ projectName, mobs, existingMobIds, onMobAdded, onCancel }: AgregarMobModalProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedMobId, setSelectedMobId] = useState<string | null>(null);
  const [assetCache] = useState(() => new Map<string, MobBaseAssetsResponse>());
  const [selectedAsset, setSelectedAsset] = useState<MobBaseAssetsResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const availableMobs = mobs.filter((mob) => !existingMobIds.includes(mob.id));
  const visibleMobs = availableMobs.filter((mob) => mob.label.toLowerCase().includes(searchText.trim().toLowerCase()));
  const selectedMob = availableMobs.find((mob) => mob.id === selectedMobId) ?? null;

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  }, []);

  const handleSelectMob = useCallback(
    (mobId: string) => {
      setSelectedMobId(mobId);
      setError(null);
      const cached = assetCache.get(mobId);
      if (cached) {
        setSelectedAsset(cached);
        return;
      }
      setSelectedAsset(null);
      fetchMobBaseAssets(mobId)
        .then((asset) => {
          assetCache.set(mobId, asset);
          setSelectedAsset(asset);
        })
        .catch((err: unknown) => {
          console.warn(`AgregarMobModal.handleSelectMob: no se pudo cargar la geometría de "${mobId}".`, err);
        });
    },
    [assetCache],
  );

  const handleConfirmAdd = useCallback(async () => {
    if (!selectedMobId) return;
    setPending(true);
    setError(null);
    try {
      const record = loadProject(projectName);
      if (!record) {
        setError(`El proyecto "${projectName}" ya no existe -- puede que se haya eliminado en otra pestaña.`);
        return;
      }
      const asset = assetCache.get(selectedMobId) ?? (await fetchMobBaseAssets(selectedMobId));
      const imageData = await decodePngDataUrlToImageData(asset.texture.dataUrl, asset.texture.width, asset.texture.height);
      const bufferCache = new Map([[selectedMobId, new TextureBuffer(imageData.width, imageData.height, imageData.data)]]);
      const geometryCache = new Map([[selectedMobId, asset.geometry]]);
      const newMobSnapshot = await buildProjectSnapshot(bufferCache, geometryCache);
      saveProject(projectName, { ...record.mobs, ...newMobSnapshot }, { overwrite: true });
      onMobAdded(selectedMobId);
    } catch (err) {
      console.error('AgregarMobModal.handleConfirmAdd: fallo agregando el mob al proyecto.', err);
      setError(err instanceof Error ? err.message : 'No se pudo agregar el mob seleccionado.');
    } finally {
      setPending(false);
    }
  }, [selectedMobId, projectName, assetCache, onMobAdded]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Agregar mob al proyecto"
      onClick={onCancel}
      className="ts-modal-backdrop"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ts-modal-panel"
        style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-raised)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 'var(--font-lg)' }}>Agregar mob al proyecto</h3>
            <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-dim)' }}>
              Selecciona un mob de Minecraft para agregarlo al proyecto. Luego podrás editar su textura.
            </p>
          </div>
          <Button variant="icon-square" onClick={onCancel} title="Cerrar">
            <IconX size={16} />
            <span className="sr-only">Cerrar</span>
          </Button>
        </div>

        <div style={{ position: 'relative' }}>
          <IconSearch size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
          <input type="search" aria-label="Buscar mob por nombre" placeholder="Buscar mob…" value={searchText} onChange={handleSearchChange} style={{ width: '100%', fontSize: 13, padding: '9px 12px 9px 32px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }} />
        </div>

        {availableMobs.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Este proyecto ya tiene todos los mobs del catálogo.</p>
        ) : visibleMobs.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Ningún mob coincide con la búsqueda.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
            {visibleMobs.map((mob) => {
              const isSelected = mob.id === selectedMobId;
              return (
                <button
                  key={mob.id}
                  type="button"
                  onClick={() => handleSelectMob(mob.id)}
                  aria-pressed={isSelected}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 10, borderRadius: 'var(--radius-md)', border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}
                >
                  <img src={MOB_ICONS[mob.id]} alt="" aria-hidden="true" style={{ width: 48, height: 48, objectFit: 'contain', imageRendering: 'pixelated' }} />
                  <span style={{ fontSize: 'var(--font-xs)', textAlign: 'center' }}>{mob.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {selectedMob && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--chip-bg)' }}>
            <img src={MOB_ICONS[selectedMob.id]} alt="" aria-hidden="true" style={{ width: 48, height: 48, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{selectedMob.label}</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>{MOB_DESCRIPTIONS[selectedMob.id] ?? ''}</div>
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', textAlign: 'right', flexShrink: 0 }}>
              <div>Resolución de textura: {selectedAsset ? `${selectedAsset.geometry.textureWidth} × ${selectedAsset.geometry.textureHeight} px (x1)` : '—'}</div>
              <div>Modelo: {selectedMob.label}</div>
            </div>
          </div>
        )}

        {error && <InlineError message={error} />}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!selectedMobId || pending} onClick={() => void handleConfirmAdd()}>
            {pending ? 'Agregando…' : 'Agregar mob'}
          </Button>
        </div>
      </div>
    </div>
  );
}
