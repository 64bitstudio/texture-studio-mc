
## Hecho

Implementado tal como estaba alcanzado, con un gap real de consistencia identificado que justificó el retiro (no solo redundancia):

- **`ProjectControls.tsx`** eliminado (`git rm`) -- el menú "💾 Proyecto" del editor permitía guardar un proyecto nuevo sin pasar por "Nuevo proyecto" (sin la restricción de un solo mob inicial) y cargar un proyecto DISTINTO al `activeProject` actual sin actualizarlo -- la app quedaba en un estado inconsistente entre la navegación y lo que el editor mostraba. Guardar/cargar/eliminar proyectos ahora vive únicamente en el flujo nuevo (038-042), que mantiene `activeProject` sincronizado en cada paso.
- Limpieza en cascada de código muerto que dependía de `ProjectControls`: `loadGeneration`/`handleProjectLoaded` (`App.tsx`, forzaban un remount de `Editor` que solo ese menú necesitaba) y `geometryCache` compartido de sesión completa (write-only desde que `NuevoProyecto.tsx`/`AgregarMobs.tsx`, tickets 038/042, migraron a Maps locales) -- ambos sin ningún consumidor real restante.
- Actualizados comentarios que referenciaban `ProjectControls.tsx` como pieza viva (`MisProyectos.tsx`, `Editor.tsx`) para reflejar el estado real; se dejaron sin tocar las referencias puramente históricas (`Button.tsx`/`InlineError.tsx`, explican el origen de una decisión pasada, no describen el presente).

Tests: 197/197 en verde (sin tests nuevos -- eliminación de UI/estado muerto, verificado en vivo). `npm run lint` y `npm run build` en verde (630 módulos, uno menos que antes).

Verificación en vivo (Claude in Chrome, local): navegación completa Mis proyectos → Set Nether (proyecto real) → Esqueleto (editor) -- el editor cargó normalmente, sin la fila/menú "💾 Proyecto" que antes vivía justo debajo del header. Búsqueda explícita confirmó que no existe ningún menú de proyecto standalone en el árbol de accesibilidad. Auditoría de código: `grep` de `'home'`/`ProjectControls`/`loadGeneration` en `frontend/src` confirma cero código muerto real (solo comentarios históricos). Sin errores en consola durante la carga ni la navegación.

Con este ticket se cierra el epic completo (034-045) de "Proyectos como concepto central + navegación nueva".

Sin hallazgos de QA pendientes.
