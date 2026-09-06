import { useCallback, useState } from 'react';
import type { MobSummary } from '../types/mobs';
import type { TextureBuffer } from '../textureBuffer';
import { listProjects, loadProject } from '../projectStorage';
import { restoreProjectBuffers } from '../projectSnapshot';
import { filterAndSortProjects } from '../projectFilter';
import { Button, InlineError, Section } from '../ui';

/** N de partida (ver ticket, "ajustable sin impacto arquitectónico"). */
const RECENT_PROJECTS_LIMIT = 5;

export interface RecientesProps {
  mobs: MobSummary[];
  /** Cache compartida de buffers por mob (ticket 018) -- mismo `Map` que usa `MisProyectos.tsx`, se puebla aca al abrir un proyecto. */
  bufferCache: Map<string, TextureBuffer>;
  /** Se llama tras abrir un proyecto con éxito, con su nombre y los ids de mob que quedaron restaurados en `bufferCache`. */
  onProjectSelected: (projectName: string, loadedMobIds: string[]) => void;
}

/** Nombre legible de un mob a partir de su id -- mismo criterio que `MisProyectos.tsx`. */
function mobLabelFor(mobId: string, mobs: MobSummary[]): string {
  return mobs.find((m) => m.id === mobId)?.label ?? mobId;
}

/**
 * Vista "Recientes" (ticket 040, HU-5) -- los `RECENT_PROJECTS_LIMIT`
 * proyectos guardados más recientemente, por `updatedAt` (ya existente
 * en `ProjectSummary` desde el ticket 027 -- NO se trackea una fecha
 * nueva de "última apertura", el documento de definición decidió
 * explícitamente derivar esto de la fecha de guardado ya disponible).
 * A diferencia de "Mis proyectos" (ticket 039), esta vista es de solo
 * lectura -- sin buscar/filtrar/ordenar, reusa `filterAndSortProjects`
 * (ticket 028) únicamente para el orden por fecha, no para buscar.
 */
export function Recientes({ mobs, bufferCache, onProjectSelected }: RecientesProps) {
  const [pendingProject, setPendingProject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allProjects = listProjects();
  const recentProjects = filterAndSortProjects(allProjects, { searchText: '', mobId: null, sortBy: 'updatedAt' }).slice(
    0,
    RECENT_PROJECTS_LIMIT,
  );

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
      <h2 style={{ margin: '0 0 4px' }}>Recientes</h2>
      <p style={{ margin: '0 0 16px', color: 'var(--text-dim)', fontSize: 13 }}>
        Los {RECENT_PROJECTS_LIMIT} proyectos que guardaste más recientemente.
      </p>

      <Section title="Proyectos recientes">
        {allProjects.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Todavía no hay proyectos guardados.</p>
        ) : (
          <>
            {error && <InlineError message={error} />}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentProjects.map((project) => (
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
          </>
        )}
      </Section>
    </div>
  );
}
