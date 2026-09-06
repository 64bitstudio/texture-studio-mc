import { useCallback, useState, type ChangeEvent } from 'react';
import { Button, FormField, InlineError, Section } from '../ui';
import { Viewer3D } from './Viewer3D';
import { useCanvasTexture } from '../hooks/useCanvasTexture';
import { fetchMobBaseAssets } from '../api/baseAssets';
import { decodePngDataUrlToImageData } from '../decodeTexture';
import { TextureBuffer } from '../textureBuffer';
import { buildProjectSnapshot } from '../projectSnapshot';
import { ProjectAlreadyExistsError, projectExists, saveProject } from '../projectStorage';
import type { MobSummary } from '../types/mobs';
import type { MobBaseAssetsResponse } from '../types/baseAssets';

export interface NuevoProyectoProps {
  mobs: MobSummary[];
  /** Se llama tras crear el proyecto con éxito -- `App.tsx` decide a qué vista navegar (ticket 041, vista de detalle de Proyecto). */
  onProjectCreated: (projectName: string, mobId: string) => void;
}

const EMPTY_BUFFER = new TextureBuffer(1, 1);

/**
 * Vista "Nuevo proyecto" (ticket 038, HU-1) -- según el mockup de
 * referencia: nombre + selección de UN mob (a diferencia de "Agregar
 * mobs", ticket 042, que es selección múltiple) + vista previa 3D en
 * vivo del mob elegido.
 *
 * El proyecto se crea con `saveProject` (ticket 019, sin cambio de
 * forma) en el momento mismo de "Crear proyecto" -- ya no queda
 * implícito a que el usuario aprete "Guardar" alguna vez despues, como
 * en el flujo viejo (ver docs/definiciones/proyectos-y-navegacion.md,
 * "Diseño técnico"). El mob elegido arranca con la MISMA textura base
 * (vanilla/placeholder) que ya usa `Editor.tsx` al abrir un mob nuevo
 * por primera vez -- mismo punto de partida, sin inventar un segundo
 * "blanco" distinto.
 */
export function NuevoProyecto({ mobs, onProjectCreated }: NuevoProyectoProps) {
  const [name, setName] = useState('');
  const [selectedMobId, setSelectedMobId] = useState<string | null>(null);
  const [assetCache] = useState(() => new Map<string, MobBaseAssetsResponse>());
  const [previewAsset, setPreviewAsset] = useState<MobBaseAssetsResponse | null>(null);
  const [previewBuffer, setPreviewBuffer] = useState<TextureBuffer | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  // Siempre se llama (nunca condicional -- reglas de hooks): con un
  // buffer de 1x1 hasta que haya vista previa real que mostrar.
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

  const handleSelectMob = useCallback(
    (mobId: string) => {
      setSelectedMobId(mobId);
      setError(null);
      setConfirmOverwrite(false);
      loadPreview(mobId);
    },
    [loadPreview],
  );

  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  }, []);

  const performCreate = useCallback(
    async (trimmedName: string, overwrite: boolean) => {
      if (!selectedMobId) return;
      setPending(true);
      setError(null);
      try {
        const asset = assetCache.get(selectedMobId) ?? (await fetchMobBaseAssets(selectedMobId));
        assetCache.set(selectedMobId, asset);
        const imageData = await decodePngDataUrlToImageData(asset.texture.dataUrl, asset.texture.width, asset.texture.height);
        const buffer = new TextureBuffer(imageData.width, imageData.height, imageData.data);
        // Maps LOCALES de un solo mob -- a propósito, NO el `bufferCache`/
        // `geometryCache` compartido de `App.tsx` (que acumula TODOS los
        // mobs visitados en la sesión): un proyecto nuevo arranca con
        // ÚNICAMENTE el mob elegido aquí, nunca con mobs de otra sesión
        // de edición sin relación.
        const mobsSnapshot = await buildProjectSnapshot(new Map([[selectedMobId, buffer]]), new Map([[selectedMobId, asset.geometry]]));
        saveProject(trimmedName, mobsSnapshot, { overwrite });
        onProjectCreated(trimmedName, selectedMobId);
      } catch (err) {
        if (err instanceof ProjectAlreadyExistsError) {
          setError(`${err.message} Vuelve a intentar crear para confirmar la sobrescritura.`);
        } else {
          setError(err instanceof Error ? err.message : 'No se pudo crear el proyecto.');
        }
      } finally {
        setPending(false);
      }
    },
    [selectedMobId, assetCache, onProjectCreated],
  );

  const handleCreateClick = useCallback(() => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Ingresa un nombre para el proyecto.');
      return;
    }
    if (!selectedMobId) {
      setError('Elige un mob para empezar el proyecto.');
      return;
    }
    if (projectExists(trimmed)) {
      setConfirmOverwrite(true);
      return;
    }
    void performCreate(trimmed, false);
  }, [name, selectedMobId, performCreate]);

  const handleConfirmOverwrite = useCallback(() => {
    setConfirmOverwrite(false);
    void performCreate(name.trim(), true);
  }, [name, performCreate]);

  const handleCancelOverwrite = useCallback(() => {
    setConfirmOverwrite(false);
  }, []);

  const selectedMobLabel = mobs.find((m) => m.id === selectedMobId)?.label ?? '';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(280px, 380px)', gap: 24, padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Nuevo proyecto</h2>
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>
            Dale un nombre a tu proyecto, selecciona un mob y comienza a editar sus texturas.
          </p>
        </div>

        <FormField label="Nombre del proyecto">
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            aria-label="Nombre del proyecto"
            placeholder="ej. Set Nether"
            style={{ fontSize: 13, padding: '6px 8px' }}
          />
        </FormField>

        <Section title="Selecciona un mob">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
            {mobs.map((mob) => {
              const isSelected = mob.id === selectedMobId;
              return (
                <Button
                  key={mob.id}
                  variant={isSelected ? 'primary' : 'secondary'}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectMob(mob.id)}
                  style={{ justifyContent: 'center' }}
                >
                  {mob.label}
                </Button>
              );
            })}
          </div>
        </Section>

        {error && <InlineError message={error} />}

        {confirmOverwrite && (
          <span role="alertdialog" aria-label="Confirmar sobrescritura de proyecto" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>Ya existe un proyecto llamado «{name.trim()}». ¿Sobrescribirlo?</span>
            <Button variant="danger" disabled={pending} onClick={handleConfirmOverwrite}>
              Sí, sobrescribir
            </Button>
            <Button disabled={pending} onClick={handleCancelOverwrite}>
              Cancelar
            </Button>
          </span>
        )}

        <Button variant="primary" disabled={pending} onClick={handleCreateClick} style={{ justifyContent: 'center' }}>
          <span aria-hidden="true">➕</span> {pending ? 'Creando…' : 'Crear proyecto'}
        </Button>
      </div>

      <Section title="Vista previa">
        {previewError && <InlineError message={previewError} />}
        {!selectedMobId && !previewError && (
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>Elige un mob para ver la vista previa.</p>
        )}
        {selectedMobId && previewAsset && previewBuffer && (
          <>
            <div style={{ height: 280 }}>
              <Viewer3D texture={previewTexture} geometry={previewAsset.geometry} mobLabel={selectedMobLabel} />
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
