import { useCallback, useState, type ChangeEvent } from 'react';
import { Button, FormField, InlineError, Section } from '../ui';
import { IconCube, IconEye, IconInfo, IconPlus, IconCheck, IconX } from '../ui/icons';
import { Viewer3D } from './Viewer3D';
import { useCanvasTexture } from '../hooks/useCanvasTexture';
import { fetchMobBaseAssets } from '../api/baseAssets';
import { decodePngDataUrlToImageData } from '../decodeTexture';
import { TextureBuffer } from '../textureBuffer';
import { buildProjectSnapshot } from '../projectSnapshot';
import { ProjectAlreadyExistsError, projectExists, saveProject } from '../projectStorage';
import { MOB_DESCRIPTIONS, MOB_ICONS } from '../mobIcons';
import type { MobSummary } from '../types/mobs';
import type { MobBaseAssetsResponse } from '../types/baseAssets';

export interface NuevoProyectoProps {
  mobs: MobSummary[];
  /** Se llama tras crear el proyecto con éxito -- `App.tsx` decide a qué vista navegar (ticket 041, vista de detalle de Proyecto). */
  onProjectCreated: (projectName: string, mobId: string) => void;
}

const EMPTY_BUFFER = new TextureBuffer(1, 1);

/** Caja de ícono compartida por los encabezados de sección (ticket 046) -- "Selecciona un mob"/"Vista previa". */
const SECTION_ICON_BOX_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  flexShrink: 0,
} as const;

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
 *
 * Ticket 046 (rediseño visual, mockup nuevo de Marco): tarjetas de mob
 * con la miniatura OFICIAL real de cada mob (`mobIcons.ts` -- renders
 * descargados de Minecraft Wiki, decisión explícita de Marco, ver
 * `docs/ARQUITECTURA.md`, "Ticket 046") + badge de check al
 * seleccionar; encabezados de sección con ícono + subtítulo; tarjeta
 * informativa del mob elegido (ícono + nombre + descripción corta,
 * copy nueva del frontend); campo de nombre con botón "limpiar". Toda
 * la lógica de arriba (estado/handlers) es exactamente la misma que
 * antes de este ticket -- solo cambia el JSX/estilos de abajo.
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

  const handleClearName = useCallback(() => {
    setName('');
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
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) minmax(300px, 420px)', gap: 28, padding: 28, maxWidth: 1200 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: 'var(--font-xl)' }}>Nuevo proyecto</h2>
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>
            Dale un nombre a tu proyecto, selecciona un mob y comienza a editar sus texturas.
          </p>
        </div>

        <FormField label="Nombre del proyecto">
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              aria-label="Nombre del proyecto"
              placeholder="ej. Set Nether"
              style={{ fontSize: 13, padding: '10px 36px 10px 12px', width: '100%', borderRadius: 'var(--radius-md)' }}
            />
            {name && (
              <button
                type="button"
                onClick={handleClearName}
                aria-label="Limpiar nombre del proyecto"
                title="Limpiar nombre del proyecto"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  borderRadius: '50%',
                }}
              >
                <IconX size={14} />
              </button>
            )}
          </div>
        </FormField>

        <Section>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 4 }}>
            <span style={SECTION_ICON_BOX_STYLE} aria-hidden="true">
              <IconCube size={18} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-md)' }}>Selecciona un mob</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>Elige el mob que quieres editar.</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
            {mobs.map((mob) => {
              const isSelected = mob.id === selectedMobId;
              const icon = MOB_ICONS[mob.id];
              return (
                <button
                  key={mob.id}
                  type="button"
                  className="ui-button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectMob(mob.id)}
                  style={{
                    position: 'relative',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: '18px 10px 12px',
                    borderRadius: 'var(--radius-lg)',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--accent-soft)' : 'var(--surface-raised)',
                  }}
                >
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        color: '#0b0e13',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconCheck size={13} />
                    </span>
                  )}
                  {icon && <img src={icon} alt="" style={{ width: 64, height: 88, objectFit: 'contain' }} />}
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                    {mob.label}
                  </span>
                </button>
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

        <Button
          variant="primary"
          disabled={pending}
          onClick={handleCreateClick}
          style={{ justifyContent: 'center', padding: '12px 16px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--font-sm)' }}
        >
          <IconPlus size={18} /> {pending ? 'Creando…' : 'Crear proyecto'}
        </Button>
      </div>

      <Section>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={SECTION_ICON_BOX_STYLE} aria-hidden="true">
              <IconEye size={18} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-md)' }}>Vista previa</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>Así se verá el mob en el juego (solo vista previa).</div>
            </div>
          </div>
          <span
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '4px 10px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Minecraft Java Edition
          </span>
        </div>

        {previewError && <InlineError message={previewError} />}
        {!selectedMobId && !previewError && (
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>Elige un mob para ver la vista previa.</p>
        )}
        {selectedMobId && previewAsset && previewBuffer && (
          <>
            <div style={{ height: 300, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <Viewer3D texture={previewTexture} geometry={previewAsset.geometry} mobLabel={selectedMobLabel} />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                marginTop: 12,
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                background: 'var(--surface-raised)',
              }}
            >
              {MOB_ICONS[selectedMobId] && (
                <img
                  src={MOB_ICONS[selectedMobId]}
                  alt=""
                  style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
                />
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>{selectedMobLabel}</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>{MOB_DESCRIPTIONS[selectedMobId] ?? ''}</div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: 12,
                marginTop: 12,
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
              }}
            >
              <span aria-hidden="true" style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 1 }}>
                <IconInfo size={16} />
              </span>
              <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                Esta es solo una vista previa aproximada del modelo -- no representa todas las animaciones del juego.
              </p>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
