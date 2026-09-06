import { useCallback, useState, type ChangeEvent } from 'react';
import type { MobSummary } from '../types/mobs';
import type { TextureBuffer } from '../textureBuffer';
import { listProjects, loadProject } from '../projectStorage';
import { restoreProjectBuffers } from '../projectSnapshot';
import { collectMobIdsInProjects, filterAndSortProjects, type ProjectSortBy } from '../projectFilter';
import { Button, InlineError, Section } from '../ui';

export interface MisProyectosProps {
  mobs: MobSummary[];
  /** Cache compartida de buffers por mob (ticket 018) -- mismo `Map` que usa `ProjectControls`, se puebla aca al abrir un proyecto. */
  bufferCache: Map<string, TextureBuffer>;
  /** Se llama tras abrir un proyecto con éxito, con su nombre y los ids de mob que quedaron restaurados en `bufferCache`. */
  onProjectSelected: (projectName: string, loadedMobIds: string[]) => void;
}

/** Nombre legible de un mob a partir de su id -- usa el catalogo YA resuelto (`mobs`), sin volver a pedirlo. Cae al propio id si el mob ya no esta en el catalogo (ej. proyecto viejo de un mob renombrado). */
function mobLabelFor(mobId: string, mobs: MobSummary[]): string {
  return mobs.find((m) => m.id === mobId)?.label ?? mobId;
}

const inlineFieldStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 } as const;
const inputStyle = { fontSize: 12, padding: '4px 6px' } as const;

/**
 * Vista "Mis proyectos" (ticket 039, HU-5) -- reubica la sección
 * "Guardados" que antes vivía en `HomeScreen.tsx` (tickets 027/028) a
 * su propio destino de navegación, SIN cambios de lógica: misma
 * búsqueda por nombre + filtro por mob + orden sobre
 * `filterAndSortProjects`/`collectMobIdsInProjects` (puras, ticket 028,
 * sin tocar). Único cambio real de comportamiento: elegir un proyecto
 * navega a su vista de detalle (`'proyecto'`, ticket 041) en vez de ir
 * directo al editor del primer mob -- los buffers se siguen
 * restaurando aquí mismo (misma lógica de `loadProject`/
 * `restoreProjectBuffers`, ticket 019), solo cambia a dónde navega
 * `App.tsx` después.
 *
 * `HomeScreen.tsx` (su origen) se eliminó en este mismo ticket -- una
 * vez que "Nuevo proyecto" (038) y "Mis proyectos" (039) tienen su
 * propio contenido real, ningún camino de la app vuelve a montarlo
 * (confirmado con grep antes de borrarlo) -- se retira ahora en vez de
 * dejarlo como código muerto hasta el ticket 045, mismo criterio ya
 * aplicado en el ticket 029 (`PanelResizeHandle.tsx`).
 */
export function MisProyectos({ mobs, bufferCache, onProjectSelected }: MisProyectosProps) {
  const [pendingProject, setPendingProject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [mobFilter, setMobFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<ProjectSortBy>('updatedAt');

  const allProjects = listProjects();
  const mobIdsInProjects = collectMobIdsInProjects(allProjects);
  const projects = filterAndSortProjects(allProjects, {
    searchText,
    mobId: mobFilter || null,
    sortBy,
  });

  function handleSearchTextChange(e: ChangeEvent<HTMLInputElement>) {
    setSearchText(e.target.value);
  }

  function handleMobFilterChange(e: ChangeEvent<HTMLSelectElement>) {
    setMobFilter(e.target.value);
  }

  function handleSortByChange(e: ChangeEvent<HTMLSelectElement>) {
    setSortBy(e.target.value as ProjectSortBy);
  }

  const handleOpenProject = useCallback(
    async (projectName: string) => {
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
        onProjectSelected(projectName, Array.from(restored.keys()));
      } catch (err) {
        setError(err instanceof Error ? err.message : `No se pudo cargar el proyecto "${projectName}".`);
      } finally {
        setPendingProject(null);
      }
    },
    [bufferCache, onProjectSelected],
  );

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ margin: '0 0 4px' }}>Mis proyectos</h2>
      <p style={{ margin: '0 0 16px', color: 'var(--text-dim)', fontSize: 13 }}>Busca, filtra y abre cualquiera de tus proyectos guardados.</p>

      <Section title="Guardados">
        {allProjects.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Todavía no hay proyectos guardados.</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
              <label style={inlineFieldStyle}>
                Buscar
                <input
                  type="search"
                  aria-label="Buscar proyecto guardado por nombre"
                  placeholder="ej. Nether"
                  value={searchText}
                  onChange={handleSearchTextChange}
                  style={inputStyle}
                />
              </label>

              {mobIdsInProjects.length > 1 && (
                <label style={inlineFieldStyle}>
                  Mob
                  <select value={mobFilter} onChange={handleMobFilterChange} aria-label="Filtrar proyectos guardados por mob" style={inputStyle}>
                    <option value="">Todos</option>
                    {mobIdsInProjects.map((mobId) => (
                      <option key={mobId} value={mobId}>
                        {mobLabelFor(mobId, mobs)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label style={inlineFieldStyle}>
                Orden
                <select value={sortBy} onChange={handleSortByChange} aria-label="Ordenar proyectos guardados" style={inputStyle}>
                  <option value="updatedAt">Más reciente primero</option>
                  <option value="name">Nombre (A-Z)</option>
                </select>
              </label>
            </div>

            {error && <InlineError message={error} />}

            {projects.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Ningún proyecto coincide con la búsqueda/filtro.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {projects.map((project) => (
                  <li key={project.name}>
                    <Button
                      disabled={pendingProject !== null}
                      onClick={() => void handleOpenProject(project.name)}
                      style={{ width: '100%', justifyContent: 'space-between' }}
                    >
                      <span>{pendingProject === project.name ? 'Abriendo…' : project.name}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                        {new Date(project.updatedAt).toLocaleDateString()} · {project.mobIds.map((id) => mobLabelFor(id, mobs)).join(', ')}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
