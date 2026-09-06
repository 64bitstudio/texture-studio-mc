import { useCallback, useState } from 'react';
import type { MobSummary } from '../types/mobs';
import type { TextureBuffer } from '../textureBuffer';
import { listProjects, loadProject } from '../projectStorage';
import { restoreProjectBuffers } from '../projectSnapshot';
import { collectMobIdsInProjects, filterAndSortProjects, type ProjectSortBy } from '../projectFilter';
import { Button, InlineError, Section } from '../ui';

export interface HomeScreenProps {
  mobs: MobSummary[];
  onSelectMob: (mobId: string) => void;
  /** Cache compartida de buffers por mob (ticket 018) -- mismo `Map` que usa `ProjectControls`, se puebla aca al cargar un proyecto desde el inicio. */
  bufferCache: Map<string, TextureBuffer>;
  /** Se llama tras cargar un proyecto con éxito, con los ids de mob que quedaron restaurados en `bufferCache`. */
  onProjectOpened: (loadedMobIds: string[]) => void;
}

/** Nombre legible de un mob a partir de su id -- usa el catalogo YA resuelto (`mobs`), sin volver a pedirlo. Cae al propio id si el mob ya no esta en el catalogo (ej. proyecto viejo de un mob renombrado). */
function mobLabelFor(mobId: string, mobs: MobSummary[]): string {
  return mobs.find((m) => m.id === mobId)?.label ?? mobId;
}

const inlineFieldStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 } as const;
const inputStyle = { fontSize: 12, padding: '4px 6px' } as const;

/**
 * Pantalla de inicio (ticket 027, HU-1) -- reemplaza la carga directa al
 * editor. Dos secciones: "Selección de mob" (catálogo ya resuelto por
 * `App.tsx`, un botón por mob) y "Guardados" (ticket 028, HU-2: búsqueda
 * por nombre + filtro por mob + orden, sobre `filterAndSortProjects`,
 * puro y testeado -- este componente solo conecta esa lógica con los
 * inputs). Cada control de filtro va envuelto en un `<label>` con texto
 * visible, con `aria-label`/`placeholder` explícitos -- mismo patrón
 * accesible que el resto del proyecto.
 *
 * La carga de un proyecto guardado reusa `loadProject`/
 * `restoreProjectBuffers` (ticket 019) -- MISMA lógica que
 * `ProjectControls.handleLoad`, pero aquí el resultado hace transicionar
 * a la vista de editor (`onProjectOpened`, manejado por `App.tsx`) en
 * vez de quedarse en el mismo lugar.
 */
export function HomeScreen({ mobs, onSelectMob, bufferCache, onProjectOpened }: HomeScreenProps) {
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

  function handleSearchTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchText(e.target.value);
  }

  function handleMobFilterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setMobFilter(e.target.value);
  }

  function handleSortByChange(e: React.ChangeEvent<HTMLSelectElement>) {
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
        onProjectOpened(Array.from(restored.keys()));
      } catch (err) {
        setError(err instanceof Error ? err.message : `No se pudo cargar el proyecto "${projectName}".`);
      } finally {
        setPendingProject(null);
      }
    },
    [bufferCache, onProjectOpened],
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16,
        padding: 24,
        maxWidth: 900,
        margin: '0 auto',
      }}
    >
      <Section title="Selección de mob">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {mobs.map((mob) => (
            <Button key={mob.id} onClick={() => onSelectMob(mob.id)}>
              {mob.label}
            </Button>
          ))}
        </div>
      </Section>

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
