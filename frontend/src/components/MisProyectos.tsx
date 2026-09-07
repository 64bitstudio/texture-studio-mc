import { useCallback, useState } from 'react';
import type { MobSummary } from '../types/mobs';
import type { TextureBuffer } from '../textureBuffer';
import type { MobGeometry } from '../types/baseAssets';
import { listProjects, loadProject } from '../projectStorage';
import { restoreProjectBuffers } from '../projectSnapshot';
import { filterAndSortProjects, type ProjectSortBy } from '../projectFilter';
import { InlineError, SearchSortToggleBar, type ToggleLayout } from '../ui';
import { ProjectCard } from './ProjectCard';

export interface MisProyectosProps {
  mobs: MobSummary[];
  /** Cache compartida de buffers por mob (ticket 018) -- el mismo `Map` que usa `Editor`/`App.tsx`, se puebla aca al abrir un proyecto. */
  bufferCache: Map<string, TextureBuffer>;
  /** Se llama al abrir un proyecto (click en la tarjeta/nombre), con su nombre y los ids de mob que quedaron restaurados en `bufferCache` -- navega a la vista de detalle (`Proyecto.tsx`). */
  onProjectSelected: (projectName: string, loadedMobIds: string[]) => void;
  /**
   * Se llama al presionar "Editar" en una tarjeta (ticket 053, distinto
   * de `onProjectSelected`) -- también con los ids de mob restaurados;
   * `App.tsx` decide el destino real (editor directo si hay 1 solo mob,
   * la vista de detalle como selector si hay varios, ver
   * `docs/ARQUITECTURA.md`, "Ticket 053").
   */
  onProjectEdit: (projectName: string, loadedMobIds: string[]) => void;
}

/**
 * Vista "Mis proyectos" (ticket 039, HU-5 -- rediseño visual y de
 * interacción del ticket 053 según imagen de referencia de Marco).
 *
 * Ticket 053 (pedido explícito, con imagen de referencia -- ver
 * `docs/ARQUITECTURA.md`, "Ticket 053"):
 * - Tarjetas reales (`ProjectCard.tsx`) en vez de una lista de botones de
 *   texto plano -- cada una resuelve sus propias acciones secundarias
 *   (Renombrar/Duplicar/Exportar/Eliminar) de forma autocontenida.
 * - El filtro por mob (`mobFilter`/`collectMobIdsInProjects`, ticket 028)
 *   se RETIRA -- decisión confirmada con Marco (`AskUserQuestion`): la
 *   imagen de referencia no lo incluye, solo queda buscar por nombre +
 *   ordenar. `filterAndSortProjects` (`projectFilter.ts`) sigue sin
 *   cambios -- simplemente ya no se le pasa `mobId`.
 * - Toggle grid/lista REAL (no decorativo, decisión confirmada con
 *   Marco) -- `ProjectCard` recibe `layout` y cambia su propio markup,
 *   este componente solo decide el contenedor (`<ul>` grid vs. columna).
 *
 * Restaurar buffers (`restoreProjectBuffers`) sigue viviendo AQUÍ (no en
 * `ProjectCard.tsx`) porque es la única acción que toca `bufferCache`
 * (compartido con el resto de la app) y navega -- exactamente el mismo
 * criterio que ya usaba este componente antes del ticket 053, ahora
 * reusado por DOS acciones distintas de la tarjeta ("abrir" y "Editar",
 * ver `handleOpenProject`/`handleEditProject` abajo) en vez de una sola.
 */
export function MisProyectos({ mobs, bufferCache, onProjectSelected, onProjectEdit }: MisProyectosProps) {
  const [pendingProject, setPendingProject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<ProjectSortBy>('updatedAt');
  const [layout, setLayout] = useState<ToggleLayout>('grid');
  // Ticket 053: ninguna acción de `ProjectCard` (renombrar/duplicar/
  // eliminar) actualiza estado propio de este componente -- `allProjects`
  // se deriva de `listProjects()` en cada render (mismo criterio que
  // siempre tuvo este componente). Este contador solo fuerza un
  // re-render cuando `ProjectCard` avisa `onChanged`.
  const [refreshTick, setRefreshTick] = useState(0);
  // Ticket 073 (pedido de Marco): las miniaturas de cada `ProjectCard`
  // ahora fotografían la textura real del proyecto (motor del ticket
  // 062) en vez del ícono vanilla fijo -- comparten esta cache de
  // geometrías entre TODAS las tarjetas de esta pantalla, mismo
  // criterio ya usado en `Proyecto.tsx` desde el ticket 055.
  const [geometryCache] = useState(() => new Map<string, MobGeometry>());

  const allProjects = listProjects();
  const projects = filterAndSortProjects(allProjects, { searchText, sortBy });

  const handleCardChanged = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  /**
   * Restaura los buffers de TODOS los mobs de un proyecto en
   * `bufferCache` y avisa via `onDone` -- compartido por "abrir" (click
   * en la tarjeta) y "Editar" (ver más abajo), que solo difieren en a
   * dónde navegan después (`onProjectSelected` vs. `onProjectEdit`).
   */
  const openProject = useCallback(
    async (projectName: string, onDone: (loadedMobIds: string[]) => void) => {
      setError(null);
      setPendingProject(projectName);
      try {
        const record = loadProject(projectName);
        if (!record) {
          setError(`El proyecto "${projectName}" ya no existe -- puede que se haya eliminado en otra pestaña.`);
          return;
        }
        const restored = await restoreProjectBuffers(record.mobs);
        for (const [mobId, buffer] of restored.entries()) {
          bufferCache.set(mobId, buffer);
        }
        onDone(Array.from(restored.keys()));
      } catch (err) {
        setError(err instanceof Error ? err.message : `No se pudo cargar el proyecto "${projectName}".`);
      } finally {
        setPendingProject(null);
      }
    },
    [bufferCache],
  );

  const handleOpenProject = useCallback(
    (projectName: string) => void openProject(projectName, (loadedMobIds) => onProjectSelected(projectName, loadedMobIds)),
    [openProject, onProjectSelected],
  );

  const handleEditProject = useCallback(
    (projectName: string) => void openProject(projectName, (loadedMobIds) => onProjectEdit(projectName, loadedMobIds)),
    [openProject, onProjectEdit],
  );

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 'var(--font-xl)' }}>Mis proyectos</h2>
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>Administra, edita o elimina tus proyectos de texturas.</p>
        </div>

        {allProjects.length > 0 && (
          <SearchSortToggleBar
            searchValue={searchText}
            onSearchChange={setSearchText}
            searchPlaceholder="Buscar proyectos…"
            searchAriaLabel="Buscar proyectos por nombre"
            sortOptions={[
              { value: 'updatedAt', label: 'Última modificación' },
              { value: 'name', label: 'Nombre (A-Z)' },
            ]}
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as ProjectSortBy)}
            sortAriaLabel="Ordenar proyectos"
            layout={layout}
            onLayoutChange={setLayout}
          />
        )}
      </div>

      {allProjects.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Todavía no hay proyectos guardados.</p>
      ) : (
        <>
          {error && <InlineError message={error} />}

          {projects.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Ningún proyecto coincide con la búsqueda.</p>
          ) : (
            <ul
              key={refreshTick}
              style={
                layout === 'grid'
                  ? { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }
                  : { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }
              }
            >
              {projects.map((project) => (
                <ProjectCard
                  key={project.name}
                  project={project}
                  mobs={mobs}
                  layout={layout}
                  geometryCache={geometryCache}
                  busy={pendingProject === project.name}
                  onOpen={() => handleOpenProject(project.name)}
                  onEdit={() => handleEditProject(project.name)}
                  onChanged={handleCardChanged}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
