import { useEffect, useState } from 'react';
import { Editor } from './components/Editor';
import { MobSelector } from './components/MobSelector';
import { ProjectControls } from './components/ProjectControls';
import { HomeScreen } from './components/HomeScreen';
import { fetchMobBaseAssets } from './api/baseAssets';
import { fetchMobs } from './api/mobs';
import type { MobBaseAssetsResponse, MobGeometry } from './types/baseAssets';
import type { MobSummary } from './types/mobs';
import { TextureBuffer } from './textureBuffer';
import { Button } from './ui';

/** Ticket 027, HU-1: pantalla de inicio en vez de cargar directo al editor. Estado interno, sin router (ver docs/definiciones/rediseno-ux-ui-y-navegacion.md, "Diseño técnico"). */
type View = 'home' | 'editor';

type MobsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; mobs: MobSummary[] };

type AssetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: MobBaseAssetsResponse };

function App() {
  // Ticket 027, HU-1: arranca en 'home', no directo al editor.
  const [view, setView] = useState<View>('home');

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

  // Ticket 019 (guardado de proyectos): geometria por mob VISITADO en la
  // sesion, en el mismo `useState` perezoso + mutacion in-place que
  // `bufferCache` de arriba (mismo criterio: nunca leer un `ref` durante
  // el render). Necesaria SOLO al guardar un proyecto -- para escalar
  // `uvBoxes` correctamente al codificar el PNG de CADA mob cacheado
  // (ticket 015, `maskPixelsOutsideUVBoxes` via `encodeBufferToPngBlob`),
  // no solo el mob actualmente activo (ver `projectSnapshot.ts`). Se
  // puebla en el efecto de fetch del asset de abajo, SIEMPRE antes de
  // que `Editor` pueda llegar a escribir el buffer correspondiente en
  // `bufferCache` (el propio `Editor` de ese mob todavia ni se monto en
  // ese punto) -- invariante: todo mobId presente en `bufferCache` tiene
  // su geometria ya en `geometryCache`.
  const [geometryCache] = useState(() => new Map<string, MobGeometry>());

  // Ticket 019: se incrementa cada vez que un proyecto cargado incluye
  // al mob ACTUALMENTE seleccionado, para forzar el remount de `Editor`
  // (ver `key` mas abajo) y que recoja de inmediato el buffer recien
  // restaurado desde `bufferCache` -- mismo mecanismo de "remount +
  // lectura perezosa desde la cache" que ya usa el cambio de mob del
  // ticket 018, sin inventar una segunda forma de sincronizar `Editor`
  // con un cambio externo al `Map`.
  const [loadGeneration, setLoadGeneration] = useState(0);

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
        if (!cancelled) {
          setAssetState({ status: 'ready', data });
          // Ticket 019: registrado ANTES de que `Editor` de este mob
          // pueda montarse (el render de `Editor` depende de
          // `assetState.status === 'ready'`, que recien se setea en la
          // linea de arriba) -- ver comentario de `geometryCache`.
          geometryCache.set(selectedMobId, data.geometry);
        }
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
  }, [selectedMobId, assetRetryCount, geometryCache]);

  function handleRetryMobs() {
    setMobsState({ status: 'loading' });
    setMobsRetryCount((c) => c + 1);
  }

  function handleRetryAsset() {
    setAssetState({ status: 'loading' });
    setAssetRetryCount((c) => c + 1);
  }

  // Ticket 027: unico punto de entrada para "activar este mob y mostrar
  // el editor" -- lo usan tanto `MobSelector` del header (mob ya en
  // vista de editor) como `HomeScreen` (primera eleccion desde el
  // inicio). `setView('editor')` es incondicional (barato si ya estaba
  // en 'editor') porque, a diferencia del cambio de mob en si, SIEMPRE
  // debe pasar -- incluso si `mobId` ya era el `selectedMobId` por
  // default (ej. el usuario vuelve al inicio y hace click en el MISMO
  // mob que ya tenia activo).
  function handleSelectMob(mobId: string) {
    if (mobId !== selectedMobId) {
      setAssetState({ status: 'loading' });
      setSelectedMobIdOverride(mobId);
    }
    setView('editor');
  }

  // Ticket 027: `HomeScreen` ya dejo los buffers restaurados en
  // `bufferCache` (mismo mecanismo que `handleProjectLoaded` de abajo,
  // ver `HomeScreen.tsx`) -- este callback solo decide a que mob
  // navegar (el primero del proyecto cargado) y cambia la vista a
  // 'editor'. NO necesita bump de `loadGeneration`: `Editor` esta
  // desmontado mientras `view === 'home'` (ver el render de abajo), asi
  // que el proximo montaje ya lee `bufferCache` desde cero via su
  // inicializador perezoso -- sin una instancia vieja que forzar a
  // remontar.
  function handleProjectOpenedFromHome(loadedMobIds: string[]) {
    const targetMobId = loadedMobIds[0] ?? selectedMobId;
    if (targetMobId && targetMobId !== selectedMobId) {
      setAssetState({ status: 'loading' });
      setSelectedMobIdOverride(targetMobId);
    }
    setView('editor');
  }

  // Ticket 019 (HU-4, "el mob actualmente activo se actualiza de
  // inmediato"): `ProjectControls` ya dejo el buffer restaurado de cada
  // mob del proyecto en `bufferCache` (mutacion directa del `Map`,
  // ver `ProjectControls.tsx`) ANTES de llamar a este callback -- si el
  // mob ACTUALMENTE seleccionado esta entre los recien restaurados, se
  // fuerza el remount de `Editor` (bump de `loadGeneration`, ver `key`
  // mas abajo) para que recoja de inmediato el buffer nuevo. Si no esta
  // entre ellos, no hace falta remontar nada -- ese buffer ya quedo
  // disponible en `bufferCache` para cuando el usuario lo seleccione
  // despues (mismo mecanismo de "cache por mob visitado" del ticket
  // 018), y forzar un remount igual solo resetearia sin necesidad el
  // zoom/historial/simetria del mob activo, que el proyecto cargado ni
  // siquiera toco.
  function handleProjectLoaded(loadedMobIds: string[]) {
    if (selectedMobId !== null && loadedMobIds.includes(selectedMobId)) {
      setLoadGeneration((g) => g + 1);
    }
  }

  const selectedMobLabel =
    (mobsState.status === 'ready' && mobsState.mobs.find((m) => m.id === selectedMobId)?.label) || null;

  // Ticket 027, HU-1: pantalla de inicio en vez del editor directo.
  // `mobsState`/`bufferCache`/`geometryCache` viven POR ENCIMA de
  // `view` (declarados antes, sin depender de el) -- por eso volver al
  // inicio y elegir el mismo mob de nuevo no pierde nada ya pintado.
  if (view === 'home') {
    return (
      <main style={{ width: '100vw', height: '100vh', overflow: 'auto' }}>
        <header style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Texture Studio MC</h1>
        </header>

        {mobsState.status === 'loading' && (
          <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
            <p>Cargando catálogo de mobs…</p>
          </div>
        )}

        {mobsState.status === 'error' && (
          <div style={{ display: 'grid', placeItems: 'center', padding: 48, gap: 12 }}>
            <p role="alert">No se pudo cargar el catálogo de mobs: {mobsState.message}</p>
            <Button onClick={handleRetryMobs}>Reintentar</Button>
          </div>
        )}

        {mobsState.status === 'ready' && (
          <HomeScreen
            mobs={mobsState.mobs}
            onSelectMob={handleSelectMob}
            bufferCache={bufferCache}
            onProjectOpened={handleProjectOpenedFromHome}
          />
        )}
      </main>
    );
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="icon" aria-label="Volver al inicio" title="Volver al inicio" onClick={() => setView('home')}>
            ←
          </Button>
          <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            Texture Studio MC{selectedMobLabel ? ` — ${selectedMobLabel}` : ''}
          </h1>
        </div>

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

      {/* Ticket 019 (HU-3/HU-4/HU-5): fila propia, hermana del header --
          un proyecto agrupa VARIOS mobs a la vez (no es un control por
          mob), y debe seguir visible sin importar cual mob este activo
          en cada momento (ver `ProjectControls.tsx`). */}
      {mobsState.status === 'ready' && (
        <div
          style={{
            flexShrink: 0,
            padding: '8px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <ProjectControls bufferCache={bufferCache} geometryCache={geometryCache} onProjectLoaded={handleProjectLoaded} />
        </div>
      )}

      {/* `mobsState.status === 'loading'/'error'` no se manejan aca --
          ya no son alcanzables en la vista de editor (ticket 027): solo
          se llega a `view === 'editor'` desde `HomeScreen`/`MobSelector`,
          y ambos solo renderizan con `mobsState.status === 'ready'`. Esos
          dos estados se manejan en la vista 'home' de arriba. */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {mobsState.status === 'ready' && selectedMobId && assetState.status === 'loading' && (
          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}>
            <p>Cargando modelo…</p>
          </div>
        )}

        {mobsState.status === 'ready' && selectedMobId && assetState.status === 'error' && (
          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', gap: 12 }}>
            <p role="alert">No se pudo cargar el modelo: {assetState.message}</p>
            <Button onClick={handleRetryAsset}>Reintentar</Button>
          </div>
        )}

        {mobsState.status === 'ready' && selectedMobId && assetState.status === 'ready' && selectedMobLabel && (
          // `key={selectedMobId}-{loadGeneration}` remonta `Editor` por
          // completo al cambiar de mob (ticket 018) -- todo su estado
          // interno (zoom, historial, simetria, parte aislada, panel de
          // importar/pegar, etc.) se resetea a los defaults de una
          // sesion nueva, EXCEPTO el `TextureBuffer` de pixeles, que
          // `Editor` recupera de `bufferCache` si ya existe para este
          // mob (ver `Editor.tsx`/`docs/ARQUITECTURA.md`, "Ticket 018")
          // -- es la unica pieza de estado que el ticket exige preservar
          // entre visitas al mismo mob dentro de la sesion.
          //
          // `loadGeneration` (ticket 019) forma parte de la `key` para
          // que cargar un proyecto que incluye al mob ACTIVO tambien
          // fuerce este mismo remount -- sin este segundo componente de
          // la key, `Editor` seguiria montado con su `buffer` viejo (el
          // `useState` inicial de `buffer` solo lee `bufferCache` en el
          // MONTAJE, nunca de nuevo) pese a que `ProjectControls` ya
          // dejo el buffer restaurado en la cache (ver
          // `handleProjectLoaded` arriba).
          <Editor
            key={`${selectedMobId}-${loadGeneration}`}
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
