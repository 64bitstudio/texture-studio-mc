import { useCallback, useState } from 'react';
import type { MobSummary } from '../types/mobs';
import type { TextureBuffer } from '../textureBuffer';
import { listProjects, loadProject } from '../projectStorage';
import { restoreProjectBuffers } from '../projectSnapshot';
import { Button, InlineError, Section } from '../ui';

export interface HomeScreenProps {
  mobs: MobSummary[];
  onSelectMob: (mobId: string) => void;
  /** Cache compartida de buffers por mob (ticket 018) -- mismo `Map` que usa `ProjectControls`, se puebla aca al cargar un proyecto desde el inicio. */
  bufferCache: Map<string, TextureBuffer>;
  /** Se llama tras cargar un proyecto con éxito, con los ids de mob que quedaron restaurados en `bufferCache`. */
  onProjectOpened: (loadedMobIds: string[]) => void;
}

/**
 * Pantalla de inicio (ticket 027, HU-1) -- reemplaza la carga directa al
 * editor. Dos secciones: "Selección de mob" (catálogo ya resuelto por
 * `App.tsx`, un botón por mob) y "Guardados" (lista simple, click para
 * abrir directo en el editor -- la búsqueda/filtro/orden completos son
 * el ticket 028, este ticket solo cubre el punto de entrada).
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
  const projects = listProjects();

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
        {error && <InlineError message={error} />}
        {projects.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Todavía no hay proyectos guardados.</p>
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
                    {new Date(project.updatedAt).toLocaleDateString()} · {project.mobIds.join(', ')}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
