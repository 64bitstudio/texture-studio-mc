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
  /**
   * Se llama tras crear el proyecto con éxito -- `App.tsx` decide a qué
   * vista navegar (ticket 041, vista de detalle de Proyecto).
   * Ticket 078: `mobIds` es la lista COMPLETA de mobs elegidos (antes,
   * siempre un solo id) -- nunca vacía (se valida en `handleCreateClick`
   * antes de poder llegar a crear el proyecto).
   */
  onProjectCreated: (projectName: string, mobIds: string[]) => void;
}

const EMPTY_BUFFER = new TextureBuffer(1, 1);

/**
 * Contenedor del visor 3D. Ticket 046 (revisión 2) había puesto una
 * cuadrícula CSS aca como aproximación, pero quedaba tapada por el
 * fondo opaco de la propia escena (`<color attach="background">` en
 * `Viewer3D.tsx`) en cuanto el modelo cargaba -- ticket 048 movió la
 * cuadrícula DENTRO de la escena 3D real (`<Grid>` de drei, ver
 * `Viewer3D.tsx`), así que este contenedor vuelve a ser solo el marco.
 */
const VIEWER_FRAME_STYLE = {
  height: 300,
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
  border: '1px solid var(--border)',
} as const;

/**
 * Vista "Nuevo proyecto" (ticket 038, HU-1) -- según el mockup de
 * referencia: nombre + selección de mobs + vista previa 3D en vivo del
 * mob elegido.
 *
 * Ticket 078 (pedido de Marco: "debe permitir seleccionar mas de un
 * mob"): la selección pasó de UN mob (`selectedMobId: string | null`) a
 * VARIOS (`selectedMobIds: string[]`) -- cada tarjeta ahora es un toggle
 * (agrega/quita del proyecto a crear), y una lista de "chips" bajo el
 * grid resume todo lo elegido (el panel "Vista previa" solo puede
 * mostrar un mob 3D a la vez, así que por sí solo no alcanza para
 * confirmar la selección completa con varios mobs). `previewMobId` es
 * un estado APARTE de la selección: cualquier click, seleccione o
 * deseleccione, actualiza cuál mob se previsualiza -- así se puede
 * revisar un mob antes de decidir si se quiere en el proyecto.
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
 * Ticket 046, revisión 2 (correcciones pedidas por Marco tras ver el
 * resultado en vivo -- todas las diferencias se verificaron con
 * recortes ampliados de la imagen de referencia, no a ojo):
 * - El contenedor ya NO tiene `maxWidth` -- ocupa todo el ancho
 *   disponible (la columna de "Vista previa" queda con un ancho
 *   acotado, `minmax(340px, 460px)`, la izquierda absorbe el resto).
 * - "Crear proyecto" se movió DEBAJO de la tarjeta "Vista previa" (2da
 *   fila del mismo grid de 2 columnas, columna derecha) -- antes vivía
 *   debajo de "Selecciona un mob" (columna izquierda).
 * - El ícono del botón ahora es un círculo oscuro con el "+" en verde
 *   adentro (antes el ícono iba suelto).
 * - Los encabezados de sección ("Selecciona un mob"/"Vista previa") ya
 *   NO envuelven su ícono en una caja con fondo -- el ícono va suelto,
 *   igual que en la referencia (confirmado con recorte ampliado).
 * - El badge "Minecraft Java Edition" pasa de pastilla con borde a
 *   rectángulo redondeado con relleno sólido (`--chip-bg`).
 * - El campo de nombre usa fondo `--bg` (no `--surface-raised`) y borde
 *   con tinte de acento; el botón "limpiar" ahora es un círculo con
 *   borde propio.
 *
 * Toda la lógica de estado/handlers de abajo es EXACTAMENTE la misma
 * que antes de este ticket -- solo cambia el JSX/estilos.
 */
export function NuevoProyecto({ mobs, onProjectCreated }: NuevoProyectoProps) {
  const [name, setName] = useState('');
  // Ticket 078 (pedido de Marco: "Nuevo proyecto" debe permitir elegir
  // MAS de un mob al crear) -- `selectedMobIds` reemplaza al antiguo
  // `selectedMobId: string | null`. Array (no `Set`) para preservar el
  // ORDEN de selección: la tarjeta "Vista previa" siempre muestra el
  // último mob tocado (`previewMobId`, separado -- ver mas abajo), y la
  // lista de "chips" bajo el grid necesita un orden estable para no
  // reordenarse solo con re-renders.
  const [selectedMobIds, setSelectedMobIds] = useState<string[]>([]);
  // Cual mob se muestra en el panel "Vista previa" (3D + info) -- NO es
  // lo mismo que "estar seleccionado": clickear una tarjeta siempre la
  // previsualiza, la seleccione o la deseleccione, para que el usuario
  // pueda revisar un mob antes de decidir si lo quiere en el proyecto.
  const [previewMobId, setPreviewMobId] = useState<string | null>(null);
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

  // Ticket 078: click en una tarjeta = alterna su selección (agrega/quita
  // del proyecto a crear) Y la muestra en "Vista previa" -- un solo
  // gesto para las dos cosas, no hace falta un modo "solo previsualizar"
  // separado (si el usuario quiere ver un mob sin agregarlo, puede
  // clickearlo de nuevo para quitarlo tras mirar la vista previa).
  const handleToggleMob = useCallback(
    (mobId: string) => {
      setSelectedMobIds((prev) => (prev.includes(mobId) ? prev.filter((id) => id !== mobId) : [...prev, mobId]));
      setPreviewMobId(mobId);
      setError(null);
      setConfirmOverwrite(false);
      loadPreview(mobId);
    },
    [loadPreview],
  );

  const handleRemoveMob = useCallback((mobId: string) => {
    setSelectedMobIds((prev) => prev.filter((id) => id !== mobId));
  }, []);

  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  }, []);

  const handleClearName = useCallback(() => {
    setName('');
  }, []);

  const performCreate = useCallback(
    async (trimmedName: string, overwrite: boolean) => {
      if (selectedMobIds.length === 0) return;
      setPending(true);
      setError(null);
      try {
        // Ticket 078: Maps LOCALES con TODOS los mobs elegidos (antes,
        // uno solo) -- sigue sin ser el `bufferCache`/`geometryCache`
        // compartido de `App.tsx` (que acumula TODOS los mobs visitados
        // en la sesión): un proyecto nuevo arranca ÚNICAMENTE con los
        // mobs elegidos aquí, nunca con mobs de otra sesión de edición
        // sin relación. `buildProjectSnapshot` ya soportaba varios mobs
        // a la vez desde el ticket 019 (lo usa `AgregarMobModal.tsx` con
        // un Map de 1 entrada) -- no hizo falta tocarlo.
        const bufferCache = new Map<string, TextureBuffer>();
        const geometryCache = new Map<string, MobBaseAssetsResponse['geometry']>();
        for (const mobId of selectedMobIds) {
          const asset = assetCache.get(mobId) ?? (await fetchMobBaseAssets(mobId));
          assetCache.set(mobId, asset);
          const imageData = await decodePngDataUrlToImageData(asset.texture.dataUrl, asset.texture.width, asset.texture.height);
          bufferCache.set(mobId, new TextureBuffer(imageData.width, imageData.height, imageData.data));
          geometryCache.set(mobId, asset.geometry);
        }
        const mobsSnapshot = await buildProjectSnapshot(bufferCache, geometryCache);
        saveProject(trimmedName, mobsSnapshot, { overwrite });
        onProjectCreated(trimmedName, selectedMobIds);
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
    [selectedMobIds, assetCache, onProjectCreated],
  );

  const handleCreateClick = useCallback(() => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Ingresa un nombre para el proyecto.');
      return;
    }
    if (selectedMobIds.length === 0) {
      setError('Elige al menos un mob para empezar el proyecto.');
      return;
    }
    if (projectExists(trimmed)) {
      setConfirmOverwrite(true);
      return;
    }
    void performCreate(trimmed, false);
  }, [name, selectedMobIds, performCreate]);

  const handleConfirmOverwrite = useCallback(() => {
    setConfirmOverwrite(false);
    void performCreate(name.trim(), true);
  }, [name, performCreate]);

  const handleCancelOverwrite = useCallback(() => {
    setConfirmOverwrite(false);
  }, []);

  const previewMobLabel = mobs.find((m) => m.id === previewMobId)?.label ?? '';

  return (
    <div className="ts-fade-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(340px, 460px)', gap: 28, padding: 28, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: 'var(--font-xl)' }}>Nuevo proyecto</h2>
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>
            Dale un nombre a tu proyecto, selecciona uno o más mobs y comienza a editar sus texturas.
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
              style={{
                fontSize: 13,
                padding: '10px 36px 10px 12px',
                width: '100%',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg)',
                border: '1px solid var(--accent-soft-strong)',
              }}
            />
            {name && (
              <button
                type="button"
                onClick={handleClearName}
                aria-label="Limpiar nombre del proyecto"
                title="Limpiar nombre del proyecto"
                style={{
                  position: 'absolute',
                  right: 7,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-strong)',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  borderRadius: '50%',
                }}
              >
                <IconX size={12} />
              </button>
            )}
          </div>
        </FormField>

        <Section>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 4 }}>
            <span aria-hidden="true" style={{ display: 'inline-flex', paddingTop: 1 }}>
              <IconCube size={22} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-md)' }}>Selecciona uno o más mobs</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                Elige los mobs que quieres editar -- puedes agregar varios a un mismo proyecto.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {mobs.map((mob) => {
              const isSelected = selectedMobIds.includes(mob.id);
              const icon = MOB_ICONS[mob.id];
              return (
                <button
                  key={mob.id}
                  type="button"
                  className="ui-button"
                  aria-pressed={isSelected}
                  onClick={() => handleToggleMob(mob.id)}
                  style={{
                    position: 'relative',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: '16px 10px 12px',
                    borderRadius: 'var(--radius-lg)',
                    background: isSelected ? 'var(--accent-soft)' : 'transparent',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                    boxShadow: isSelected ? '0 0 20px -4px var(--accent-soft-strong)' : 'none',
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
                        color: '#0f171d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconCheck size={13} />
                    </span>
                  )}
                  {icon && <img src={icon} alt="" style={{ width: '100%', height: 128, objectFit: 'contain' }} />}
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                    {mob.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Ticket 078: resumen de TODOS los mobs elegidos -- el panel
              "Vista previa" de la derecha solo muestra uno a la vez
              (`previewMobId`), asi que esta lista es la unica forma de
              confirmar de un vistazo qué se va a crear cuando hay mas
              de un mob seleccionado. */}
          {selectedMobIds.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {selectedMobIds.map((mobId) => {
                const mob = mobs.find((m) => m.id === mobId);
                if (!mob) return null;
                return (
                  <span
                    key={mobId}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 6px 5px 12px',
                      borderRadius: 999,
                      background: 'var(--chip-bg)',
                      fontSize: 'var(--font-xs)',
                      fontWeight: 600,
                    }}
                  >
                    {mob.label}
                    <button
                      type="button"
                      onClick={() => handleRemoveMob(mobId)}
                      aria-label={`Quitar ${mob.label} de la selección`}
                      title={`Quitar ${mob.label}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: 'none',
                        background: 'var(--surface-raised)',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                      }}
                    >
                      <IconX size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
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
      </div>

      <Section>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ display: 'inline-flex', paddingTop: 1 }}>
              <IconEye size={20} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-md)' }}>Vista previa</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>Así se verá el mob en el juego (solo vista previa).</div>
            </div>
          </div>
          <span
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--text)',
              background: 'var(--chip-bg)',
              borderRadius: 10,
              padding: '6px 12px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Minecraft Java Edition
          </span>
        </div>

        {previewError && <InlineError message={previewError} />}
        {!previewMobId && !previewError && (
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>Elige un mob para ver la vista previa.</p>
        )}
        {previewMobId && previewAsset && previewBuffer && (
          <>
            {/* Ticket 077 (bug real reportado por Marco: "la vista
                inicial del renderizado de la araña esta mal, se muestra
                de espaldas" -- comparado contra el icono de la
                izquierda). Causa: `<Canvas camera={{position: ...}}>`
                de react-three-fiber solo aplica esa posicion inicial UNA
                vez, al MONTAR el Canvas -- una vez que `OrbitControls`
                toma control de la camara, cambios posteriores al prop
                `camera` (ej. al cambiar de mob sin recargar la pagina)
                NO la reposicionan. Sin `key`, esta pantalla reusaba el
                MISMO Canvas/OrbitControls al pasar de un mob a otro,
                asi que la Araña heredaba la orientacion de camara donde
                haya quedado el mob anterior -- nunca su propio encuadre
                calculado (cabeza al centro, ver `Viewer3D.tsx`). `key=
                {previewMobId}` fuerza un remount completo del Canvas al
                cambiar de mob, igual patron que `key={viewerKey}` ya usa
                `Editor.tsx` para su boton "Restablecer". */}
            <div style={VIEWER_FRAME_STYLE}>
              <Viewer3D key={previewMobId} texture={previewTexture} geometry={previewAsset.geometry} mobLabel={previewMobLabel} />
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
              }}
            >
              {MOB_ICONS[previewMobId] && <img src={MOB_ICONS[previewMobId]} alt="" style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />}
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>{previewMobLabel}</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>{MOB_DESCRIPTIONS[previewMobId] ?? ''}</div>
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
                border: '1px solid var(--border)',
              }}
            >
              {/* Ticket 048: `IconInfo` ya es un badge relleno con
                  colores fijos (ver `ui/icons.tsx`) -- el `span`
                  envolvente ya no necesita fijar `color` (no queda
                  ningún `currentColor` que heredar), solo el
                  alineado/flexShrink. */}
              <span aria-hidden="true" style={{ flexShrink: 0 }}>
                <IconInfo size={28} />
              </span>
              <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--text-dim)', alignSelf: 'center' }}>
                Esta es solo una vista previa aproximada del modelo -- no representa todas las animaciones del juego.
              </p>
            </div>
          </>
        )}
      </Section>

      <div aria-hidden="true" />
      <Button
        variant="primary"
        disabled={pending}
        onClick={handleCreateClick}
        style={{ justifyContent: 'center', padding: '12px 16px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--font-sm)' }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#0f171d',
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          <IconPlus size={14} />
        </span>
        {pending ? 'Creando…' : 'Crear proyecto'}
      </Button>
    </div>
  );
}
