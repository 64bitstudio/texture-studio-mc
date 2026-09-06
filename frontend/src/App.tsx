import { useEffect, useState } from 'react';
import { Editor } from './components/Editor';
import { MobSelector } from './components/MobSelector';
import { fetchMobBaseAssets } from './api/baseAssets';
import { fetchMobs } from './api/mobs';
import type { MobBaseAssetsResponse } from './types/baseAssets';
import type { MobSummary } from './types/mobs';
import { TextureBuffer } from './textureBuffer';

type MobsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; mobs: MobSummary[] };

type AssetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: MobBaseAssetsResponse };

function App() {
  // Catalogo de mobs (ticket 018, HU-1) -- `GET /api/mobs`. El menu no
  // hardcodea ninguna lista: muestra exactamente lo que este fetch
  // devuelva (hoy Esqueleto/Zombie, ver `pending/018-...md`, "Que NO
  // construir").
  const [mobsState, setMobsState] = useState<MobsState>({ status: 'loading' });
  const [mobsRetryCount, setMobsRetryCount] = useState(0);

  // Seleccion EXPLICITA del usuario (click en `MobSelector`) -- `null`
  // mientras no haya elegido nada todavia, en cuyo caso `selectedMobId`
  // (mas abajo) se DERIVA como el primer mob del catalogo, sin un
  // efecto dedicado a "sincronizar" ese default (oxlint `react(set-
  // state-in-effect)`: derivar durante el render en vez de un efecto
  // que solo copia un valor de otro estado).
  const [selectedMobIdOverride, setSelectedMobIdOverride] = useState<string | null>(null);
  const selectedMobId =
    selectedMobIdOverride ?? (mobsState.status === 'ready' ? (mobsState.mobs[0]?.id ?? null) : null);

  const [assetState, setAssetState] = useState<AssetState>({ status: 'loading' });
  // Se incrementa para forzar un nuevo fetch desde el boton "Reintentar"
  // del asset del mob activo (independiente del retry del catalogo).
  const [assetRetryCount, setAssetRetryCount] = useState(0);

  // Ticket 018 (HU-2, "el trabajo del primer mob debe seguir ahi"):
  // cache de `TextureBuffer` por mob VISITADO EN LA SESION. Vive en
  // `useState` con inicializador perezoso (nunca se vuelve a asignar --
  // se lee la MISMA instancia de `Map` en cada render y se muta en su
  // lugar via `.set(...)` dentro de `Editor.tsx`) en vez de `useRef`,
  // para no disparar el warning de oxlint `react(refs)` ("no leer
  // `.current` durante el render") al pasarla como prop mas abajo --
  // mismo criterio de "inicializador perezoso, no ref leido durante el
  // render" ya establecido por `useCanvasTexture.ts` (ver
  // docs/ARQUITECTURA.md, ticket 002). Solo vive en memoria de la
  // sesion activa -- ninguna escritura a `localStorage` aca, el
  // guardado de proyectos es el ticket 019.
  const [bufferCache] = useState(() => new Map<string, TextureBuffer>());

  useEffect(() => {
    let cancelled = false;

    fetchMobs()
      .then((mobs) => {
        if (!cancelled) setMobsState({ status: 'ready', mobs });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Error desconocido cargando el catálogo de mobs.';
          setMobsState({ status: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mobsRetryCount]);

  // Fetch del asset del mob activo. Deliberadamente SIN ningun
  // `setAssetState({status: 'loading'})` sincrono al inicio del cuerpo
  // del efecto (oxlint `react(set-state-in-effect)`) -- `assetState`
  // arranca en `'loading'` por default (cubre la carga inicial y la
  // autoseleccion del primer mob, que no pasa por ningun handler) y
  // cualquier transicion posterior a "loading" la dispara el EVENTO que
  // la causa (`handleSelectMob`/`handleRetryAsset` mas abajo), no este
  // efecto -- que solo sincroniza con el fetch en si.
  useEffect(() => {
    if (selectedMobId === null) return;
    let cancelled = false;

    fetchMobBaseAssets(selectedMobId)
      .then((data) => {
        if (!cancelled) setAssetState({ status: 'ready', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Error desconocido cargando el asset base.';
          setAssetState({ status: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMobId, assetRetryCount]);

  function handleRetryMobs() {
    setMobsState({ status: 'loading' });
    setMobsRetryCount((c) => c + 1);
  }

  function handleRetryAsset() {
    setAssetState({ status: 'loading' });
    setAssetRetryCount((c) => c + 1);
  }

  function handleSelectMob(mobId: string) {
    if (mobId === selectedMobId) return;
    setAssetState({ status: 'loading' });
    setSelectedMobIdOverride(mobId);
  }

  const selectedMobLabel =
    (mobsState.status === 'ready' && mobsState.mobs.find((m) => m.id === selectedMobId)?.label) || null;

  return (
    <main style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          flexShrink: 0,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
          Texture Studio MC{selectedMobLabel ? ` — ${selectedMobLabel}` : ''}
        </h1>

        {mobsState.status === 'ready' && selectedMobId && (
          <MobSelector mobs={mobsState.mobs} selectedMobId={selectedMobId} onSelect={handleSelectMob} />
        )}

        {assetState.status === 'ready' && assetState.data.texture.isPlaceholder && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              background: 'var(--panel-bg)',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            Textura placeholder (asset vanilla real pendiente — ver ticket 007)
          </span>
        )}
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        {mobsState.status === 'loading' && (
          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}>
            <p>Cargando catálogo de mobs…</p>
          </div>
        )}

        {mobsState.status === 'error' && (
          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', gap: 12 }}>
            <p role="alert">No se pudo cargar el catálogo de mobs: {mobsState.message}</p>
            <button type="button" onClick={handleRetryMobs}>
              Reintentar
            </button>
          </div>
        )}

        {mobsState.status === 'ready' && selectedMobId && assetState.status === 'loading' && (
          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}>
            <p>Cargando modelo…</p>
          </div>
        )}

        {mobsState.status === 'ready' && selectedMobId && assetState.status === 'error' && (
          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', gap: 12 }}>
            <p role="alert">No se pudo cargar el modelo: {assetState.message}</p>
            <button type="button" onClick={handleRetryAsset}>
              Reintentar
            </button>
          </div>
        )}

        {mobsState.status === 'ready' && selectedMobId && assetState.status === 'ready' && selectedMobLabel && (
          // `key={selectedMobId}` remonta `Editor` por completo al cambiar
          // de mob (ticket 018) -- todo su estado interno (zoom, historial,
          // simetria, parte aislada, panel de importar/pegar, etc.) se
          // resetea a los defaults de una sesion nueva, EXCEPTO el
          // `TextureBuffer` de pixeles, que `Editor` recupera de
          // `bufferCache` si ya existe para este mob (ver `Editor.tsx`/
          // `docs/ARQUITECTURA.md`, "Ticket 018") -- es la unica pieza de
          // estado que el ticket exige preservar entre visitas al mismo
          // mob dentro de la sesion.
          <Editor
            key={selectedMobId}
            data={assetState.data}
            mobId={selectedMobId}
            mobLabel={selectedMobLabel}
            bufferCache={bufferCache}
          />
        )}
      </div>
    </main>
  );
}

export default App;
