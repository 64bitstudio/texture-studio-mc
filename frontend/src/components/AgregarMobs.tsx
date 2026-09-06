import { useCallback, useState } from 'react';
import { Button, InlineError, Section } from '../ui';
import { Viewer3D } from './Viewer3D';
import { useCanvasTexture } from '../hooks/useCanvasTexture';
import { fetchMobBaseAssets } from '../api/baseAssets';
import { decodePngDataUrlToImageData } from '../decodeTexture';
import { TextureBuffer } from '../textureBuffer';
import { buildProjectSnapshot } from '../projectSnapshot';
import { loadProject, saveProject } from '../projectStorage';
import type { MobSummary } from '../types/mobs';
import type { MobBaseAssetsResponse } from '../types/baseAssets';

export interface AgregarMobsProps {
  projectName: string;
  mobs: MobSummary[];
  /** El proyecto ya llevaba estos mobs -- NO aparecen seleccionables (ticket, "Qué NO hacer": la restricción es estructural, no solo al confirmar). */
  existingMobIds: string[];
  /** Se llama tras agregar con éxito, con los ids que efectivamente se sumaron -- `App.tsx` actualiza `activeProject.mobIds` y navega de vuelta a `'proyecto'`. */
  onMobsAdded: (addedMobIds: string[]) => void;
  onCancel: () => void;
}

const EMPTY_BUFFER = new TextureBuffer(1, 1);

/**
 * Vista "Agregar mobs" (ticket 042, HU-3) -- reusa el layout visual de
 * "Nuevo proyecto" (038: grid de mobs + vista previa 3D en vivo), pero
 * con selección MÚLTIPLE (a diferencia de la de a uno de 038) y
 * excluyendo los mobs que el proyecto YA tiene (ocultos del grid, no
 * solo deshabilitados -- un proyecto no puede tener dos texturas del
 * mismo mob, ver `docs/definiciones/proyectos-y-navegacion.md`).
 *
 * Cada mob agregado arranca con la MISMA textura base
 * (vanilla/placeholder) que ya usa `NuevoProyecto.tsx`/`Editor.tsx` al
 * abrir un mob por primera vez -- mismo punto de partida, sin inventar
 * un segundo "blanco" distinto.
 */
export function AgregarMobs({ projectName, mobs, existingMobIds, onMobsAdded, onCancel }: AgregarMobsProps) {
  const [selectedMobIds, setSelectedMobIds] = useState<Set<string>>(new Set());
  const [previewMobId, setPreviewMobId] = useState<string | null>(null);
  const [assetCache] = useState(() => new Map<string, MobBaseAssetsResponse>());
  const [previewAsset, setPreviewAsset] = useState<MobBaseAssetsResponse | null>(null);
  const [previewBuffer, setPreviewBuffer] = useState<TextureBuffer | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewTexture = useCanvasTexture(previewBuffer ?? EMPTY_BUFFER, 0);

  const loadPreview = useCallback(
    (mobId: string) => {
      const cached = assetCache.get(mobId);
      if (cached) {
        setPreviewAsset(cached);
        void decodePngDataUrlToImageData(cached.texture.dataUrl, cached.texture.width, cached.texture.height).then((imageData) => {
          setPreviewBuffer(new TextureBuffer(imageData.width, imageData.height, imageData.data));
        });
        return;
      }
      setPreviewAsset(null);
      setPreviewBuffer(null);
      setPreviewError(null);
      fetchMobBaseAssets(mobId)
        .then((data) => {
          assetCache.set(mobId, data);
          setPreviewAsset(data);
          return decodePngDataUrlToImageData(data.texture.dataUrl, data.texture.width, data.texture.height);
        })
        .then((imageData) => {
          setPreviewBuffer(new TextureBuffer(imageData.width, imageData.height, imageData.data));
        })
        .catch((err: unknown) => {
          setPreviewError(err instanceof Error ? err.message : 'No se pudo cargar la vista previa.');
        });
    },
    [assetCache],
  );

  const handleToggleMob = useCallback(
    (mobId: string) => {
      setError(null);
      setSelectedMobIds((current) => {
        const next = new Set(current);
        if (next.has(mobId)) {
          next.delete(mobId);
        } else {
          next.add(mobId);
          setPreviewMobId(mobId);
          loadPreview(mobId);
        }
        return next;
      });
    },
    [loadPreview],
  );

  const handleConfirmAdd = useCallback(async () => {
    if (selectedMobIds.size === 0) {
      setError('Elige al menos un mob para agregar.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const record = loadProject(projectName);
      if (!record) {
        setError(`El proyecto "${projectName}" ya no existe -- puede que se haya eliminado en otra pestaña.`);
        return;
      }
      const newMobsBufferCache = new Map<string, TextureBuffer>();
      const newMobsGeometryCache = new Map<string, MobBaseAssetsResponse['geometry']>();
      for (const mobId of selectedMobIds) {
        const asset = assetCache.get(mobId) ?? (await fetchMobBaseAssets(mobId));
        assetCache.set(mobId, asset);
        const imageData = await decodePngDataUrlToImageData(asset.texture.dataUrl, asset.texture.width, asset.texture.height);
        newMobsBufferCache.set(mobId, new TextureBuffer(imageData.width, imageData.height, imageData.data));
        newMobsGeometryCache.set(mobId, asset.geometry);
      }
      const newMobsSnapshot = await buildProjectSnapshot(newMobsBufferCache, newMobsGeometryCache);
      saveProject(projectName, { ...record.mobs, ...newMobsSnapshot }, { overwrite: true });
      onMobsAdded(Array.from(selectedMobIds));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron agregar los mobs seleccionados.');
    } finally {
      setPending(false);
    }
  }, [selectedMobIds, projectName, assetCache, onMobsAdded]);

  const availableMobs = mobs.filter((mob) => !existingMobIds.includes(mob.id));
  const previewMobLabel = mobs.find((m) => m.id === previewMobId)?.label ?? '';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(280px, 380px)', gap: 24, padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Agregar mobs</h2>
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>
            Elige uno o varios mobs para sumar a «{projectName}». Los que ya tiene el proyecto no aparecen aquí.
          </p>
        </div>

        <Section title="Mobs disponibles">
          {availableMobs.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Este proyecto ya tiene todos los mobs del catálogo.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
              {availableMobs.map((mob) => {
                const isSelected = selectedMobIds.has(mob.id);
                return (
                  <Button
                    key={mob.id}
                    variant={isSelected ? 'primary' : 'secondary'}
                    aria-pressed={isSelected}
                    onClick={() => handleToggleMob(mob.id)}
                    style={{ justifyContent: 'center' }}
                  >
                    {isSelected && <span aria-hidden="true">✓</span>} {mob.label}
                  </Button>
                );
              })}
            </div>
          )}
        </Section>

        {error && <InlineError message={error} />}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" disabled={pending || availableMobs.length === 0} onClick={() => void handleConfirmAdd()}>
            <span aria-hidden="true">➕</span> {pending ? 'Agregando…' : `Agregar ${selectedMobIds.size > 0 ? `(${selectedMobIds.size})` : ''}`}
          </Button>
          <Button disabled={pending} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>

      <Section title="Vista previa">
        {previewError && <InlineError message={previewError} />}
        {!previewMobId && !previewError && (
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>Selecciona un mob para ver la vista previa.</p>
        )}
        {previewMobId && previewAsset && previewBuffer && (
          <>
            <div style={{ height: 280 }}>
              <Viewer3D texture={previewTexture} geometry={previewAsset.geometry} mobLabel={previewMobLabel} />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
              Esta es solo una vista previa aproximada del modelo -- no representa todas las animaciones del juego.
            </p>
          </>
        )}
      </Section>
    </div>
  );
}
