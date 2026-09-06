import { useEffect, useState } from 'react';
import { Editor } from './components/Editor';
import { MobSelector } from './components/MobSelector';
import { ProjectControls } from './components/ProjectControls';
import { MisProyectos } from './components/MisProyectos';
import { Recientes } from './components/Recientes';
import { Proyecto } from './components/Proyecto';
import { AppShell } from './components/AppShell';
import type { NavView } from './components/Sidebar';
import { ThemeToggle } from './components/ThemeToggle';
import { Avatar } from './components/Avatar';
import { Settings } from './components/Settings';
import { PlaceholderScreen } from './components/PlaceholderScreen';
import { NuevoProyecto } from './components/NuevoProyecto';
import { getUserPrefs } from './userPrefs';
import { getTheme, type Theme } from './theme';
import { fetchMobBaseAssets } from './api/baseAssets';
import { fetchMobs } from './api/mobs';
import type { MobBaseAssetsResponse, MobGeometry } from './types/baseAssets';
import type { MobSummary } from './types/mobs';
import { TextureBuffer } from './textureBuffer';
import { Button, LoadingOverlay, Menu } from './ui';

/**
 * Ticket 037 (HU-5): union ampliado -- reemplaza el binario `'home' |
 * 'editor'` del ticket 027 por los 7 destinos del mockup de navegación
 * nueva. Sigue sin router (mismo criterio del ticket 027: sin
 * necesidad de URLs compartibles/marcables para este flujo de sesión
 * única) -- estado interno de React, no rutas reales. `'proyecto'`/
 * `'agregar-mobs'` todavía no son alcanzables desde ninguna UI en este
 * ticket (los tickets 041/042 los conectan) -- existen en el tipo
 * desde ya porque el ticket lo pide explícitamente ("el union type más
 * grande"), con `PlaceholderScreen` cubriendo el contenido mientras
 * tanto (ver docs/definiciones/proyectos-y-navegacion.md).
 */
type View = 'nuevo-proyecto' | 'mis-proyectos' | 'recientes' | 'proyecto' | 'agregar-mobs' | 'editor' | 'configuracion';

type MobsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; mobs: MobSummary[] };

type AssetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: MobBaseAssetsResponse };

function App() {
  // Ticket 037: arranca en 'nuevo-proyecto' (primer destino del
  // sidebar, mismo rol que 'home' antes de este ticket).
  const [view, setView] = useState<View>('nuevo-proyecto');

  // Ticket 036 (HU-6): nombre del perfil local, levantado aca porque lo
  // leen DOS componentes hermanos (`Avatar` en el header, `Settings` al
  // editarlo) -- evita releer `localStorage` en cada uno o inventar un
  // mecanismo de eventos para un caso de 2 consumidores.
  const [displayName, setDisplayName] = useState(() => getUserPrefs().displayName);
  // Mismo criterio que `displayName` de arriba -- `ThemeToggle` (header)
  // y `Settings` (Configuración) son DOS componentes hermanos que
  // pueden cambiar la MISMA preferencia; levantar el estado aca es lo
  // que los mantiene sincronizados (bug real encontrado en vivo:
  // cambiar el tema desde Configuración no actualizaba el texto del
  // toggle rapido, que tenia su propio `useState` desincronizado).
  const [theme, setTheme] = useState<Theme>(() => getTheme());

  // Ticket 038 (adelanta una pieza minima del ticket 041, "vista de
  // detalle de Proyecto"): cual proyecto esta activo ahora mismo --
  // poblado al crearlo (`handleProjectCreated` mas abajo). El ticket
  // 041 construye el contenido REAL de la vista `'proyecto'` sobre este
  // mismo estado (sin cambiar su forma) -- por ahora solo alcanza para
  // que el `PlaceholderScreen` de esa vista muestre el nombre del
  // proyecto recien creado, en vez de un texto generico.
  const [activeProject, setActiveProject] = useState<{ name: string; mobIds: string[] } | null>(null);

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

  // Ticket 037: Configuración ya es un destino real de navegación (no
  // un overlay con su propio "Cerrar", ver `Settings.tsx`) -- salir de
  // ahí es simplemente navegar a cualquier otro item del sidebar, que
  // sigue visible siempre.
  function handleOpenSettings() {
    setView('configuracion');
  }

  // Ticket 027: unico punto de entrada para "activar este mob y mostrar
  // el editor" -- lo usa `MobSelector` del header (mob ya en vista de
  // editor). `setView('editor')` es incondicional (barato si ya estaba
  // en 'editor') porque, a diferencia del cambio de mob en si, SIEMPRE
  // debe pasar -- incluso si `mobId` ya era el `selectedMobId` por
  // default.
  function handleSelectMob(mobId: string) {
    if (mobId !== selectedMobId) {
      setAssetState({ status: 'loading' });
      setSelectedMobIdOverride(mobId);
    }
    setView('editor');
  }

  // Ticket 038/039: fuente unica para "un proyecto quedo activo,
  // navegar a su vista de detalle" -- la usan tanto `NuevoProyecto.tsx`
  // (crear, `mobIds` siempre de un solo elemento) como `MisProyectos.tsx`
  // (abrir uno existente, `mobIds` los que efectivamente se restauraron
  // en `bufferCache`). El ticket 041 construye el contenido real de
  // `'proyecto'` sobre este mismo estado, sin cambiar su forma.
  function handleProjectActivated(projectName: string, mobIds: string[]) {
    setActiveProject({ name: projectName, mobIds });
    setView('proyecto');
  }

  function handleProjectCreated(projectName: string, mobId: string) {
    handleProjectActivated(projectName, [mobId]);
  }

  // Ticket 041: acciones de la vista de detalle de "Proyecto".
  function handleAddMobs() {
    setView('agregar-mobs');
  }

  function handleProjectRenamed(newName: string) {
    setActiveProject((prev) => (prev ? { ...prev, name: newName } : prev));
  }

  function handleProjectDeleted() {
    setActiveProject(null);
    setView('mis-proyectos');
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

  // Ticket 037: todas las vistas EXCEPTO 'editor' se envuelven en
  // `<AppShell>` (sidebar + header persistentes) -- el editor conserva
  // su layout dedicado propio, sin sidebar, para maximizar el espacio
  // de trabajo (ver el bloque `if (view === 'editor')` mas abajo).
  if (view !== 'editor') {
    // `activeNav` resalta el item del sidebar SOLO si `view` es
    // exactamente uno de sus 3 destinos -- `'proyecto'`/`'agregar-mobs'`/
    // `'configuracion'` son subvistas alcanzadas DESDE ahi, no items
    // propios del sidebar (ver `Sidebar.tsx`).
    const activeNav: NavView | null =
      view === 'nuevo-proyecto' || view === 'mis-proyectos' || view === 'recientes' ? view : null;

    return (
      <AppShell
        activeNav={activeNav}
        onNavigate={setView}
        displayName={displayName}
        theme={theme}
        onThemeChange={setTheme}
        onOpenSettings={handleOpenSettings}
      >
        {view === 'configuracion' && (
          <Settings displayName={displayName} onDisplayNameSaved={setDisplayName} theme={theme} onThemeChange={setTheme} />
        )}

        {/* Ticket 038: "Nuevo proyecto" ya tiene contenido real (antes
            mostraba temporalmente el mismo `HomeScreen` que "Mis
            proyectos", ver `docs/ARQUITECTURA.md`, "Ticket 037"). */}
        {view === 'nuevo-proyecto' && (
          <>
            {mobsState.status === 'loading' && <LoadingOverlay message="Cargando catálogo de mobs…" />}

            {mobsState.status === 'error' && (
              <div style={{ display: 'grid', placeItems: 'center', padding: 48, gap: 12 }}>
                <p role="alert">No se pudo cargar el catálogo de mobs: {mobsState.message}</p>
                <Button onClick={handleRetryMobs}>Reintentar</Button>
              </div>
            )}

            {mobsState.status === 'ready' && <NuevoProyecto mobs={mobsState.mobs} onProjectCreated={handleProjectCreated} />}
          </>
        )}

        {/* Ticket 039: "Mis proyectos" ya tiene contenido real (antes
            mostraba temporalmente el mismo `HomeScreen`, ver
            `docs/ARQUITECTURA.md`, "Ticket 037"/"Ticket 039" -- ese
            componente se eliminó en este ticket, ya sin consumidores). */}
        {view === 'mis-proyectos' && (
          <>
            {mobsState.status === 'loading' && <LoadingOverlay message="Cargando catálogo de mobs…" />}

            {mobsState.status === 'error' && (
              <div style={{ display: 'grid', placeItems: 'center', padding: 48, gap: 12 }}>
                <p role="alert">No se pudo cargar el catálogo de mobs: {mobsState.message}</p>
                <Button onClick={handleRetryMobs}>Reintentar</Button>
              </div>
            )}

            {mobsState.status === 'ready' && (
              <MisProyectos mobs={mobsState.mobs} bufferCache={bufferCache} onProjectSelected={handleProjectActivated} />
            )}
          </>
        )}

        {/* Ticket 040: "Recientes" ya tiene contenido real. */}
        {view === 'recientes' && (
          <>
            {mobsState.status === 'loading' && <LoadingOverlay message="Cargando catálogo de mobs…" />}

            {mobsState.status === 'error' && (
              <div style={{ display: 'grid', placeItems: 'center', padding: 48, gap: 12 }}>
                <p role="alert">No se pudo cargar el catálogo de mobs: {mobsState.message}</p>
                <Button onClick={handleRetryMobs}>Reintentar</Button>
              </div>
            )}

            {mobsState.status === 'ready' && (
              <Recientes mobs={mobsState.mobs} bufferCache={bufferCache} onProjectSelected={handleProjectActivated} />
            )}
          </>
        )}
        {/* Ticket 041: "Proyecto" ya tiene contenido real. */}
        {view === 'proyecto' && activeProject && mobsState.status === 'ready' && (
          <Proyecto
            projectName={activeProject.name}
            mobs={mobsState.mobs}
            onSelectMob={handleSelectMob}
            onAddMobs={handleAddMobs}
            onProjectRenamed={handleProjectRenamed}
            onProjectDeleted={handleProjectDeleted}
          />
        )}
        {view === 'agregar-mobs' && <PlaceholderScreen title="Agregar mobs" ticket={42} />}
      </AppShell>
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
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Ticket 032 (HU-7): texto visible junto al icono -- ya no
              solo icono (`aria-label` se elimina, el texto real es
              ahora el nombre accesible; `title` se conserva como
              tooltip adicional). */}
          <Button variant="icon" title="Volver al inicio" onClick={() => setView('nuevo-proyecto')}>
            <span aria-hidden="true">←</span> Volver al inicio
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle theme={theme} onThemeChange={setTheme} />
          <Button variant="icon" title="Configuración" onClick={handleOpenSettings}>
            <span aria-hidden="true">⚙️</span> Configuración
          </Button>
          <Avatar displayName={displayName} />
        </div>
      </header>

      {/* Ticket 019 (HU-3/HU-4/HU-5): fila propia, hermana del header --
          un proyecto agrupa VARIOS mobs a la vez (no es un control por
          mob), y debe seguir visible sin importar cual mob este activo
          en cada momento (ver `ProjectControls.tsx`).

          Ticket 031 (HU-6): `ProjectControls` deja de mostrarse siempre
          expandida -- vive detras de un menu "Proyecto" (`Menu` de
          `ui/`), sin cambios de logica (mismos props/handlers). Se
          queda en `App.tsx` (NO se mueve al `Menu` "Archivo" de
          `Editor.tsx`) por la misma razon original de este comentario:
          si viviera dentro de `Editor` se remontaria por completo cada
          vez que `Editor` se remonta al cambiar de mob (`key`, ticket
          018), perdiendo su estado -- ver docs/ARQUITECTURA.md,
          "Ticket 031", para el detalle completo de por que son DOS
          menus (Archivo/Proyecto) y no uno solo. */}
      {mobsState.status === 'ready' && (
        <div
          style={{
            flexShrink: 0,
            padding: '8px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Menu
            label={
              <>
                <span aria-hidden="true">💾</span> Proyecto
              </>
            }
            items={[]}
          >
            <div style={{ padding: 8, minWidth: 260 }}>
              <ProjectControls bufferCache={bufferCache} geometryCache={geometryCache} onProjectLoaded={handleProjectLoaded} />
            </div>
          </Menu>
        </div>
      )}

      {/* `mobsState.status === 'loading'/'error'` no se manejan aca --
          ya no son alcanzables en la vista de editor (ticket 027): solo
          se llega a `view === 'editor'` desde `NuevoProyecto`/`MisProyectos`/`MobSelector`,
          y ambos solo renderizan con `mobsState.status === 'ready'`. Esos
          dos estados se manejan en 'nuevo-proyecto'/'mis-proyectos' de arriba. */}
      {/* `position: relative` (ticket 033, HU-8): ancla `LoadingOverlay`
          a esta area (el editor), no a toda la ventana -- cubre el
          cambio de mob (`assetState` vuelve a `loading` en
          `handleSelectMob`/`handleProjectOpenedFromHome`) y la carga
          inicial (arranca en `loading` por default, ver `useState`
          arriba). */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {mobsState.status === 'ready' && selectedMobId && assetState.status === 'loading' && (
          <LoadingOverlay message="Cargando modelo…" />
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
