import { useEffect, useState } from 'react';
import { Editor } from './components/Editor';
import { MisProyectos } from './components/MisProyectos';
import { Proyecto } from './components/Proyecto';
import { AgregarMobModal } from './components/AgregarMobModal';
import { ModelEditor3D } from './components/ModelEditor3D';
import { EditorProjectSidebar } from './components/EditorProjectSidebar';
import { AppShell } from './components/AppShell';
import type { NavView } from './components/Sidebar';
import { Settings } from './components/Settings';
import { NuevoProyecto } from './components/NuevoProyecto';
import { getUserPrefs } from './userPrefs';
import { getTheme, type Theme } from './theme';
import { getSidebarCollapsed, setSidebarCollapsed } from './sidebarCollapse';
import { fetchMobBaseAssets } from './api/baseAssets';
import { fetchMobs } from './api/mobs';
import { loadProject, updateMobGeometry } from './projectStorage';
import { buildConfirmedMobEntry } from './projectSnapshot';
import type { MobBaseAssetsResponse, MobGeometry } from './types/baseAssets';
import type { MobSummary } from './types/mobs';
import { TextureBuffer } from './textureBuffer';
import { Button, LoadingOverlay } from './ui';

/**
 * Ticket 037 (HU-5): union ampliado -- reemplaza el binario `'home' |
 * 'editor'` del ticket 027 por los 7 destinos del mockup de navegación
 * nueva. Sigue sin router (mismo criterio del ticket 027: sin
 * necesidad de URLs compartibles/marcables para este flujo de sesión
 * única) -- estado interno de React, no rutas reales. Los 7 destinos
 * ya tienen contenido real desde el ticket 042 (el último,
 * `'agregar-mobs'`, cierra el epic -- `PlaceholderScreen.tsx`, que
 * cubría los que faltaban desde el ticket 037, se eliminó por completo
 * al quedar sin consumidores, ver docs/ARQUITECTURA.md, "Ticket 042").
 */
// Ticket 071 (pedido de Marco, con imagen de referencia): "Agregar mob"
// deja de ser una vista propia (`'agregar-mobs'`, ticket 042, retirada
// en este ticket) -- pasa a ser un modal (`AgregarMobModal.tsx`) que se
// abre/cierra sobre `'proyecto'` con un booleano (`showAddMobModal`
// abajo), no un valor más de `View`.
//
// Pedido de Marco: "Recientes" se retira por completo -- deja de ser un
// destino navegable (`Recientes.tsx` se elimina del repo, sin
// consumidores).
// Ticket 083 -- 'editor-modelo' (Etapa 1 del epic de modelado 3D, ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md): nueva
// subvista alcanzada desde el menú "⋮" de una tarjeta de mob en
// `Proyecto.tsx` ("Editar modelo 3D"), no desde el flujo principal de
// "agregar mob" -- ver la decisión de alcance documentada en
// `ModelEditor3D.tsx`.
type View = 'nuevo-proyecto' | 'mis-proyectos' | 'proyecto' | 'editor' | 'editor-modelo' | 'configuracion';

type MobsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; mobs: MobSummary[] };

type AssetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: MobBaseAssetsResponse };

/** Estado del fetch de geometría para `'editor-modelo'` -- deliberadamente separado de `AssetState` (que trae textura+geometría del mob de la Etapa 3): la Etapa 1 no necesita textura (ver `ModelEditor3D.tsx`). */
type ModelEditorGeometryState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; geometry: MobGeometry };

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

  // Pedido de Marco ("que el sidebar pueda hacerse pequeno") -- mismo
  // patron exacto que `theme` de arriba: estado levantado aca (no local
  // a `Sidebar.tsx`) para que sobreviva remounts de `Sidebar` (ninguno
  // hoy, pero mismo criterio preventivo) y persista via
  // `sidebarCollapse.ts` (localStorage), leido una sola vez al montar
  // (lazy initial state).
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(() => getSidebarCollapsed());
  function handleToggleSidebarCollapsed() {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      setSidebarCollapsed(next);
      return next;
    });
  }

  // Ticket 038: cual proyecto esta activo ahora mismo -- poblado al
  // crearlo (`handleProjectCreated`), abrirlo (`handleProjectActivated`)
  // o agregarle mobs (`handleMobsAdded`). Fuente de verdad que usan
  // `Proyecto.tsx` (041) y `AgregarMobModal.tsx` (071, antes
  // `AgregarMobs.tsx`, ticket 042); el ticket 043 la usa tambien para
  // restringir el selector de mob del editor.
  const [activeProject, setActiveProject] = useState<{ name: string; mobIds: string[] } | null>(null);
  // Ticket 071: "Agregar mob" es un modal sobre `'proyecto'`, no una
  // vista propia -- este booleano decide si `AgregarMobModal` se monta.
  const [showAddMobModal, setShowAddMobModal] = useState(false);

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

  // Ticket 086 -- para un mob ya CONFIRMADO (`geometryStatus ===
  // 'confirmado'`), el editor de textura usa la geometría/textura
  // CUSTOM guardada localmente, nunca el catálogo vainilla del backend.
  // Derivado durante el render (no un efecto que solo copie este valor
  // a `assetState`) -- mismo criterio ya establecido arriba para
  // `selectedMobId`, evita el patrón `react(set-state-in-effect)`. El
  // efecto de fetch de más abajo se salta el fetch en este caso (ver
  // ese efecto), así que `assetState` nunca llega a pisar este valor
  // con el catálogo vainilla.
  const confirmedMobEntry = activeProject && selectedMobId ? loadProject(activeProject.name)?.mobs[selectedMobId] : undefined;
  const effectiveAssetState: AssetState =
    confirmedMobEntry?.geometryStatus === 'confirmado' && confirmedMobEntry.customGeometry
      ? {
          status: 'ready',
          data: {
            geometry: confirmedMobEntry.customGeometry,
            texture: {
              dataUrl: confirmedMobEntry.pngDataUrl,
              width: confirmedMobEntry.customGeometry.textureWidth,
              height: confirmedMobEntry.customGeometry.textureHeight,
              isPlaceholder: false,
            },
          },
        }
      : assetState;

  // Ticket 083 -- mob que se está modelando en 'editor-modelo' ahora
  // mismo. Estado separado de `selectedMobId` (Etapa 3, editor de
  // textura) -- ambas subvistas pueden referirse a mobs distintos del
  // mismo proyecto sin pisarse.
  const [editingModelMobId, setEditingModelMobId] = useState<string | null>(null);
  const [modelEditorGeometryState, setModelEditorGeometryState] = useState<ModelEditorGeometryState>({ status: 'loading' });

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
    // Ticket 086: un mob confirmado ya se resuelve via `effectiveAssetState`
    // (derivado arriba) -- fetchear el catalogo vainilla aca seria
    // trabajo desperdiciado (y, peor, sobreescribiria `assetState` con
    // datos que de todas formas no se usan para renderizar, pero
    // podrian causar una condicion de carrera confusa si algun dia se
    // vuelven a leer).
    if (confirmedMobEntry?.geometryStatus === 'confirmado' && confirmedMobEntry.customGeometry) return;
    let cancelled = false;

    fetchMobBaseAssets(selectedMobId)
      .then((data) => {
        if (!cancelled) {
          setAssetState({ status: 'ready', data });
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
  }, [selectedMobId, assetRetryCount, confirmedMobEntry]);

  // Ticket 083 -- fetch de geometría (SIN textura) para 'editor-modelo'.
  // Mismo patrón que el efecto de `assetState` de arriba (sin
  // `setModelEditorGeometryState({status: 'loading'})` síncrono en el
  // cuerpo del efecto -- la transición a "loading" la dispara
  // `handleEditModel`, no este efecto).
  //
  // Ticket 084 (hallazgo real, encontrado extendiendo este ticket):
  // esto ANTES siempre pedía la geometría vainilla del catálogo, sin
  // importar si el mob ya tenía `customGeometry` guardada de una
  // sesión de edición anterior -- reabrir "Editar modelo 3D" descartaba
  // en silencio cualquier jerarquía/caja agregada antes. Fix: si el
  // proyecto ya tiene `customGeometry` para este mob, `handleEditModel`
  // ya la resolvió de forma síncrona (sin pasar por "loading") -- este
  // efecto repite la MISMA verificación (barata, pura) para no
  // fetchear nada en ese caso, en vez de guardar esa decisión en un
  // estado aparte solo para comunicarla entre el handler y el efecto.
  useEffect(() => {
    if (editingModelMobId === null || !activeProject) return;
    if (loadProject(activeProject.name)?.mobs[editingModelMobId]?.customGeometry) return;

    let cancelled = false;

    fetchMobBaseAssets(editingModelMobId)
      .then((data) => {
        if (!cancelled) setModelEditorGeometryState({ status: 'ready', geometry: data.geometry });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Error desconocido cargando la geometría.';
          setModelEditorGeometryState({ status: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editingModelMobId, activeProject]);

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

  // Ticket 083 -- "Editar modelo 3D" (menú "⋮" de una tarjeta de mob en
  // `Proyecto.tsx`). Mismo criterio que `handleSelectMob`: la
  // transición a "loading" se dispara aquí (evento), nunca en el
  // efecto que hace el fetch.
  function handleEditModel(mobId: string) {
    // Ticket 086, defensa en profundidad: la UI (`MobEntryCard.tsx`)
    // deshabilita "Editar modelo 3D" para un mob ya confirmado, pero
    // este handler tambien lo rechaza por si acaso -- HU-6, ultimo
    // criterio de aceptacion ("la opcion no esta disponible").
    const mobEntry = activeProject ? loadProject(activeProject.name)?.mobs[mobId] : undefined;
    if (mobEntry?.geometryStatus === 'confirmado') {
      console.warn(`handleEditModel: "${mobId}" ya esta confirmado -- el editor de modelo esta bloqueado para el (duplicar el proyecto para cambiar su geometria).`);
      return;
    }

    // Ticket 084: si el mob ya tiene `customGeometry` guardada (sesion
    // de edicion anterior), se resuelve de una vez -- el efecto de
    // abajo no necesita fetchear nada, y evita el patron de
    // `setState` sincrono dentro de un efecto (regla ya establecida en
    // este archivo, ver el comentario del efecto de `assetState`).
    const existingCustomGeometry = mobEntry?.customGeometry;
    setModelEditorGeometryState(existingCustomGeometry ? { status: 'ready', geometry: existingCustomGeometry } : { status: 'loading' });
    setEditingModelMobId(mobId);
    setView('editor-modelo');
  }

  function handleModelEditorBack() {
    setView('proyecto');
  }

  // "Continuar" del editor de modelo -- sin cambios reales, no escribe
  // nada (el mob sigue siendo 'vanilla', sin efecto alguno). Con
  // cambios, persiste geometryStatus='modelando' + la geometría final;
  // la transición formal a 'confirmado' (con atlas UV) es el ticket 086,
  // todavía no construido -- por eso se vuelve a 'proyecto', no a
  // 'editor' (no hay atlas con el que texturizar todavía).
  function handleSaveDraft(finalGeometry: MobGeometry, hasChanges: boolean) {
    if (hasChanges && activeProject && editingModelMobId) {
      updateMobGeometry(activeProject.name, editingModelMobId, { geometryStatus: 'modelando', customGeometry: finalGeometry });
    }
    setView('proyecto');
  }

  // Ticket 086 -- "Confirmar modelo": cierra la Etapa 2. `confirmedGeometry`
  // ya viene con el atlas UV aplicado (`ModelEditor3D.handleConfirm`,
  // via `confirmModelGeometry`). Genera el PNG en blanco del tamaño del
  // atlas (`buildConfirmedMobEntry`, projectSnapshot.ts -- async, unica
  // razon de que este handler tambien lo sea), guarda TODO de una vez
  // (`geometryStatus: 'confirmado'`, la geometria, el PNG) y navega
  // directo al editor de textura -- sin pasar por `'proyecto'` primero,
  // ahorrandole un click a quien ya termino de modelar y quiere
  // empezar a pintar de inmediato.
  async function handleConfirmModel(confirmedGeometry: MobGeometry) {
    if (!activeProject || !editingModelMobId) return;
    const mobId = editingModelMobId;

    const confirmedEntry = await buildConfirmedMobEntry(confirmedGeometry);
    updateMobGeometry(activeProject.name, mobId, confirmedEntry);

    setSelectedMobIdOverride(mobId);
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

  // Ticket 078 (pedido de Marco: "Nuevo proyecto" debe permitir elegir
  // MAS de un mob al crear, no solo uno) -- `mobIds` ahora es la lista
  // completa elegida en `NuevoProyecto.tsx` (antes siempre un array de 1
  // elemento). `handleProjectActivated` ya aceptaba `mobIds: string[]`
  // desde el ticket 038/039 (pensado para `MisProyectos.tsx`), asi que
  // no hizo falta tocarlo -- este wrapper solo documenta el punto de
  // entrada especifico de "crear".
  function handleProjectCreated(projectName: string, mobIds: string[]) {
    handleProjectActivated(projectName, mobIds);
  }

  // Ticket 053: acción "Editar" de una tarjeta de "Mis proyectos" --
  // DISTINTA de abrir el proyecto (`handleProjectActivated`, que siempre
  // navega a `'proyecto'`). Decisión confirmada con Marco (dio
  // discreción explícita: "el editor podría abrir la última textura
  // editada o una vista para elegir cuál editar"): con UN solo mob no
  // hay nada que elegir, se va derecho al editor
  // (`handleSelectMob`, mismo punto de entrada que ya usa el resto de
  // la app); con VARIOS mobs se reusa `Proyecto.tsx` (ticket 041) como
  // la "vista para elegir cuál editar" -- ya es exactamente eso, sin
  // necesitar trackear un "último mob editado" que hoy no existe en
  // `ProjectRecord` (ver `docs/ARQUITECTURA.md`, "Ticket 053").
  function handleProjectEdit(projectName: string, mobIds: string[]) {
    setActiveProject({ name: projectName, mobIds });
    if (mobIds.length === 1) {
      handleSelectMob(mobIds[0]!);
    } else {
      setView('proyecto');
    }
  }

  // Ticket 041: acciones de la vista de detalle de "Proyecto".
  // Ticket 071: abre el modal en vez de navegar a una vista aparte.
  function handleAddMobs() {
    setShowAddMobModal(true);
  }

  function handleProjectRenamed(newName: string) {
    setActiveProject((prev) => (prev ? { ...prev, name: newName } : prev));
  }

  // Ticket 058: "Eliminar mob del proyecto" desde el menú "⋮" de una
  // tarjeta de `Proyecto.tsx` -- mismo criterio que `handleProjectRenamed`/
  // `handleMobAdded`, mantiene `activeProject.mobIds` sincronizado con
  // lo que de verdad quedó en `localStorage` (`removeMobFromProject`, ya
  // llamado por `Proyecto.tsx` antes de este callback). Sin este ajuste,
  // `existingMobIds` de `AgregarMobModal.tsx` y el filtro de `editorMobs`
  // de abajo seguirían viendo el mob recién quitado como si perteneciera
  // al proyecto (bug real encontrado en vivo).
  function handleMobRemoved(mobId: string) {
    setActiveProject((prev) => (prev ? { ...prev, mobIds: prev.mobIds.filter((id) => id !== mobId) } : prev));
  }

  function handleProjectDeleted() {
    setActiveProject(null);
    setView('mis-proyectos');
  }

  // Ticket 042/071: `AgregarMobModal.tsx` ya llamo a `saveProject` con
  // exito ANTES de este callback (mismo orden que el resto de acciones
  // de proyecto) -- suma el id recien agregado a `activeProject.mobIds`
  // (sin duplicar si por alguna razon ya estaba) y cierra el modal
  // (ticket 071: ya no navega, `'proyecto'` sigue siendo la vista
  // activa por debajo).
  function handleMobAdded(addedMobId: string) {
    setActiveProject((prev) => (prev ? { ...prev, mobIds: Array.from(new Set([...prev.mobIds, addedMobId])) } : prev));
    setShowAddMobModal(false);
  }

  function handleCancelAddMob() {
    setShowAddMobModal(false);
  }

  const selectedMobLabel =
    (mobsState.status === 'ready' && mobsState.mobs.find((m) => m.id === selectedMobId)?.label) || null;

  // Ticket 043 (HU-2): el editor muestra solo los mobs del proyecto
  // activo -- `activeProject` deberia estar SIEMPRE poblado al llegar a
  // `'editor'` en este punto del epic (toda navegacion a editor pasa
  // por `Proyecto.tsx`, tickets 038-042) -- el fallback al catalogo
  // completo es puramente defensivo, no un camino real alcanzable
  // desde la UI.
  const editorMobs =
    mobsState.status === 'ready' && activeProject
      ? mobsState.mobs.filter((mob) => activeProject.mobIds.includes(mob.id))
      : mobsState.status === 'ready'
        ? mobsState.mobs
        : [];

  // Ticket 071: el modal "Agregar mob" se puede abrir tanto desde
  // "Proyecto" (`Proyecto.tsx`, botón del header/tarjeta "Agregar mob")
  // como desde el editor (sidebar del ticket 072, botón "+ Agregar
  // mob" -- mismo `handleAddMobs`) -- se calcula UNA vez aquí y se
  // inserta en el único `return` de abajo (ambas vistas comparten el
  // mismo `<AppShell>` desde el ticket 072).
  const addMobModal =
    showAddMobModal && activeProject && mobsState.status === 'ready' ? (
      <AgregarMobModal
        projectName={activeProject.name}
        mobs={mobsState.mobs}
        existingMobIds={activeProject.mobIds}
        onMobAdded={handleMobAdded}
        onCancel={handleCancelAddMob}
      />
    ) : null;

  // Ticket 072 (pedido de Marco, con imagen de referencia): contenido
  // extra del sidebar SOLO cuando el editor está activo -- "Proyecto
  // actual" + "Mobs del proyecto" (con el mob activo resaltado, click
  // para cambiar de mob sin volver a "Proyecto" primero). Reemplaza al
  // selector de pestañas (`MobSelector.tsx`, retirado en este ticket)
  // que antes vivía en la topbar dedicada del editor (también retirada
  // -- ver `sidebarExtra` más abajo, el editor ya comparte el mismo
  // `<AppShell>` que el resto de la app en vez de su propio layout).
  const editorSidebarExtra =
    view === 'editor' && activeProject && mobsState.status === 'ready' ? (
      <EditorProjectSidebar
        projectName={activeProject.name}
        mobs={editorMobs}
        activeMobId={selectedMobId ?? ''}
        onSelectMob={handleSelectMob}
        onBackToProject={() => setView('proyecto')}
        onAddMob={handleAddMobs}
      />
    ) : undefined;

  // Ticket 037/072: TODAS las vistas (incluido el editor, desde el
  // ticket 072 -- pedido de Marco, con imagen de referencia: el editor
  // recupera el sidebar completo de navegación) se envuelven en el
  // mismo `<AppShell>` (sidebar + header persistentes).
  // `activeNav` resalta el item del sidebar SOLO si `view` es
  // exactamente uno de sus 3 destinos -- `'proyecto'`/`'editor'`/
  // `'configuracion'` son subvistas alcanzadas DESDE ahi, no items
  // propios del sidebar (ver `Sidebar.tsx`). Ticket 071: "Agregar
  // mob" ya no es una `View` -- es un modal sobre `'proyecto'`, ver
  // `showAddMobModal`.
  const activeNav: NavView | null = view === 'nuevo-proyecto' || view === 'mis-proyectos' ? view : null;

  return (
    <AppShell
        activeNav={activeNav}
        onNavigate={setView}
        displayName={displayName}
        theme={theme}
        onThemeChange={setTheme}
        onOpenSettings={handleOpenSettings}
        sidebarExtra={editorSidebarExtra}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebarCollapsed={handleToggleSidebarCollapsed}
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
              <MisProyectos
                mobs={mobsState.mobs}
                bufferCache={bufferCache}
                onProjectSelected={handleProjectActivated}
                onProjectEdit={handleProjectEdit}
              />
            )}
          </>
        )}

        {/* Ticket 041: "Proyecto" ya tiene contenido real. */}
        {view === 'proyecto' && activeProject && mobsState.status === 'ready' && (
          <Proyecto
            projectName={activeProject.name}
            mobs={mobsState.mobs}
            onSelectMob={handleSelectMob}
            onEditModel={handleEditModel}
            onAddMobs={handleAddMobs}
            onProjectRenamed={handleProjectRenamed}
            onProjectDeleted={handleProjectDeleted}
            onMobRemoved={handleMobRemoved}
            onBackToList={() => setView('mis-proyectos')}
          />
        )}
        {/* Ticket 072 (pedido de Marco, con imagen de referencia): el
            editor ya NO tiene su propio `<main>`/header dedicado (ver
            docs/ARQUITECTURA.md, "Ticket 072", que reemplaza la decisión
            del ticket 037/045 citada más abajo) -- comparte el mismo
            `<AppShell>` que el resto de la app, con "Proyecto
            actual"/"Mobs del proyecto" viviendo en el sidebar
            (`editorSidebarExtra`, arriba) en vez de un `MobSelector` en
            una topbar propia (retirado). `Editor.tsx` construye su
            propio breadcrumb/título/toolbar/paneles por dentro; acá solo
            se resuelven los 3 estados de carga del asset, igual que
            antes. */}
        {view === 'editor' && (
          <div style={{ position: 'relative', minHeight: '100%' }}>
            {mobsState.status === 'ready' && selectedMobId && effectiveAssetState.status === 'loading' && (
              <LoadingOverlay message="Cargando modelo…" />
            )}

            {mobsState.status === 'ready' && selectedMobId && effectiveAssetState.status === 'error' && (
              <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', minHeight: 400, gap: 12 }}>
                <p role="alert">No se pudo cargar el modelo: {effectiveAssetState.message}</p>
                <Button onClick={handleRetryAsset}>Reintentar</Button>
              </div>
            )}

            {mobsState.status === 'ready' && selectedMobId && effectiveAssetState.status === 'ready' && selectedMobLabel && (
              // `key={selectedMobId}` remonta `Editor` por completo al
              // cambiar de mob (ticket 018) -- todo su estado interno (zoom,
              // historial, simetria, parte aislada, panel de importar/pegar,
              // etc.) se resetea a los defaults de una sesion nueva, EXCEPTO
              // el `TextureBuffer` de pixeles, que `Editor` recupera de
              // `bufferCache` si ya existe para este mob (ver
              // `Editor.tsx`/`docs/ARQUITECTURA.md`, "Ticket 018") -- es la
              // unica pieza de estado que el ticket exige preservar entre
              // visitas al mismo mob dentro de la sesion.
              <Editor
                key={selectedMobId}
                data={effectiveAssetState.data}
                mobId={selectedMobId}
                mobLabel={selectedMobLabel}
                bufferCache={bufferCache}
                projectName={activeProject?.name ?? ''}
                onBackToProjectsList={() => setView('mis-proyectos')}
                onBackToProject={() => setView('proyecto')}
              />
            )}
          </div>
        )}

        {/* Ticket 083 -- editor de modelo 3D (Etapa 1). Sin `bufferCache`/textura, a diferencia de 'editor' -- ver `ModelEditor3D.tsx`. */}
        {view === 'editor-modelo' && activeProject && editingModelMobId && (
          <div style={{ position: 'relative', minHeight: '100%' }}>
            {modelEditorGeometryState.status === 'loading' && <LoadingOverlay message="Cargando geometría…" />}

            {modelEditorGeometryState.status === 'error' && (
              <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', minHeight: 400, gap: 12 }}>
                <p role="alert">No se pudo cargar la geometría: {modelEditorGeometryState.message}</p>
                <Button onClick={handleModelEditorBack}>Volver</Button>
              </div>
            )}

            {modelEditorGeometryState.status === 'ready' && (
              <ModelEditor3D
                key={editingModelMobId}
                mobId={editingModelMobId}
                mobLabel={mobsState.status === 'ready' ? (mobsState.mobs.find((m) => m.id === editingModelMobId)?.label ?? editingModelMobId) : editingModelMobId}
                projectName={activeProject.name}
                baseGeometry={modelEditorGeometryState.geometry}
                onBackToProjectsList={() => setView('mis-proyectos')}
                onBackToProject={handleModelEditorBack}
                onSaveDraft={handleSaveDraft}
                onConfirm={(geometry) => void handleConfirmModel(geometry)}
              />
            )}
          </div>
        )}

        {/* Ticket 071 (pedido de Marco, con imagen de referencia): "Agregar mob" es un modal sobre "Proyecto", ya no una vista aparte (retira `AgregarMobs.tsx`, ticket 042) -- también se abre desde el editor (sidebar, `editorSidebarExtra`). */}
        {addMobModal}
      </AppShell>
  );
}

export default App;
