import { useCallback, useState } from 'react';
import { ProjectAlreadyExistsError, deleteProject, duplicateProject, loadProject, renameProject } from '../projectStorage';
import { exportProjectZip } from '../export';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type DuplicateResult = { ok: true; name: string } | { ok: false; error: string };

/**
 * Lógica compartida de las 4 acciones de gestión de un proyecto
 * (Renombrar/Duplicar/Exportar/Eliminar) -- extraída en el ticket 056
 * para que `ProjectCard.tsx` (tickets 053/054, menú "⋮" de "Mis
 * proyectos") y `Proyecto.tsx` (ticket 056, panel de "Acciones" dentro
 * del detalle de un proyecto) llamen exactamente al mismo código en vez
 * de mantener una tercera copia de `renameProject`/`duplicateProject`/
 * `exportProjectZip`/`deleteProject` con su manejo de errores.
 *
 * Deliberadamente NO decide ninguna UI (no hay `menuMode`, no hay
 * confirmación inline) -- cada pantalla sigue dueña de su propia
 * presentación (una es un menú desplegable compacto, la otra un panel
 * fijo de página completa; forzar el mismo markup en ambas sería peor
 * que la pequeña duplicación de JSX que evita). Este hook solo
 * centraliza QUÉ pasa al ejecutar cada acción y CÓMO se reporta un
 * error -- el mismo criterio para las dos pantallas.
 *
 * Cada error se reporta DOS veces, nunca en silencio (mismo criterio ya
 * establecido en `readAllProjects`, `projectStorage.ts`): `console.error`
 * (SIEMPRE la primera línea de cada `catch`, para diagnosticar un fallo
 * real en consola) y `setActionError`, que lo deja visible en la UI
 * (`<InlineError>` en ambos consumidores). Cada acción devuelve un
 * resultado tipado explícito (`{ ok: true, ... } | { ok: false, error }`)
 * en vez de `null`/`false` -- quien llama nunca tiene que adivinar si un
 * valor "vacío" significa éxito o fallo.
 */
export function useProjectActions(projectName: string) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const clearError = useCallback(() => setActionError(null), []);

  const rename = useCallback(
    (newName: string): ActionResult => {
      const trimmed = newName.trim();
      if (!trimmed) {
        const error = 'Ingresa un nombre para el proyecto.';
        setActionError(error);
        return { ok: false, error };
      }
      if (trimmed === projectName) {
        setActionError(null);
        return { ok: true };
      }
      try {
        renameProject(projectName, trimmed);
        setActionError(null);
        return { ok: true };
      } catch (err) {
        console.error(`useProjectActions.rename: fallo renombrando proyecto.`, err);
        const error =
          err instanceof ProjectAlreadyExistsError
            ? `Ya existe un proyecto llamado "${trimmed}" -- elige otro nombre.`
            : err instanceof Error
              ? err.message
              : 'No se pudo renombrar el proyecto.';
        setActionError(error);
        return { ok: false, error };
      }
    },
    [projectName],
  );

  const duplicate = useCallback((): DuplicateResult => {
    try {
      const newName = duplicateProject(projectName);
      setActionError(null);
      return { ok: true, name: newName };
    } catch (err) {
      console.error(`useProjectActions.duplicate: fallo duplicando proyecto.`, err);
      const error = err instanceof Error ? err.message : 'No se pudo duplicar el proyecto.';
      setActionError(error);
      return { ok: false, error };
    }
  }, [projectName]);

  const exportZip = useCallback(async () => {
    setActionError(null);
    setExporting(true);
    try {
      const record = loadProject(projectName);
      if (!record) {
        console.error(`useProjectActions.exportZip: el proyecto ya no existe.`, projectName);
        setActionError(`El proyecto "${projectName}" ya no existe -- puede que se haya eliminado en otra pestaña.`);
        return;
      }
      await exportProjectZip(projectName, record.mobs);
    } catch (err) {
      console.error(`useProjectActions.exportZip: fallo exportando proyecto.`, err);
      setActionError(err instanceof Error ? err.message : 'No se pudo exportar el proyecto.');
    } finally {
      setExporting(false);
    }
  }, [projectName]);

  const remove = useCallback((): ActionResult => {
    try {
      deleteProject(projectName);
      setActionError(null);
      return { ok: true };
    } catch (err) {
      console.error(`useProjectActions.remove: fallo eliminando proyecto.`, err);
      const error = err instanceof Error ? err.message : 'No se pudo eliminar el proyecto.';
      setActionError(error);
      return { ok: false, error };
    }
  }, [projectName]);

  return { actionError, exporting, rename, duplicate, exportZip, remove, clearError };
}
