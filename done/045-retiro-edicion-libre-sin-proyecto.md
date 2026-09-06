# 045 — Retiro del flujo de edición libre sin proyecto

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` ("Alcance — No incluye" / "Diseño técnico — cambio de comportamiento señalado explícitamente"). Último ticket del epic — depende de que 037-044 ya cubran el flujo nuevo completo (navegación, crear/abrir proyecto, editar, agregar mobs, exportar).

## Alcance
- Limpieza final: retira cualquier ruta/UI que todavía permita editar la textura de un mob SIN pertenecer a un proyecto (la antigua sección "Selección de mob" de `HomeScreen.tsx`, y cualquier resto del flujo `view: 'home'` binario que no haya sido reemplazado ya en el ticket 037).
- Retira/limpia código muerto que haya quedado de la navegación vieja (componentes, props, estados) — mismo criterio ya aplicado en el ticket 029 (git rm explícito, no solo dejar de usar).
- Actualiza `docs/ARQUITECTURA.md` documentando explícitamente este cambio de comportamiento (regla 9 de CLAUDE.md: "cambios que rompen compatibilidad... requieren señalarlo explícitamente") — aunque ya fue confirmado por Marco en la fase de definición, se documenta en el repo como referencia futura.

## Qué NO hacer
- No retirar nada de esto ANTES de que el flujo nuevo (037-044) esté completo y verificado en vivo — este ticket va al final a propósito, para no dejar a la app sin forma de editar una textura en algún punto intermedio.

## Verificación
- En vivo (Claude in Chrome): confirmar que ya no existe ninguna forma de llegar al editor sin pasar por un proyecto (crear uno nuevo o abrir uno existente); revisión de código confirmando que no queda código muerto de la navegación vieja.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que exploro toda la navegación de la app, cuando busco una forma de editar un mob sin pasar por un proyecto, entonces no la encuentro — toda edición requiere un proyecto activo.
- Dado el código fuente, cuando reviso `HomeScreen.tsx` y el `view` viejo de `App.tsx`, entonces no queda código muerto de la navegación anterior sin usar.

## Hecho

Implementado tal como estaba alcanzado, con un gap real de consistencia identificado que justificó el retiro (no solo redundancia):

- **`ProjectControls.tsx`** eliminado (`git rm`) -- el menú "💾 Proyecto" del editor permitía guardar un proyecto nuevo sin pasar por "Nuevo proyecto" (sin la restricción de un solo mob inicial) y cargar un proyecto DISTINTO al `activeProject` actual sin actualizarlo -- la app quedaba en un estado inconsistente entre la navegación y lo que el editor mostraba. Guardar/cargar/eliminar proyectos ahora vive únicamente en el flujo nuevo (038-042), que mantiene `activeProject` sincronizado en cada paso.
- Limpieza en cascada de código muerto que dependía de `ProjectControls`: `loadGeneration`/`handleProjectLoaded` (`App.tsx`, forzaban un remount de `Editor` que solo ese menú necesitaba) y `geometryCache` compartido de sesión completa (write-only desde que `NuevoProyecto.tsx`/`AgregarMobs.tsx`, tickets 038/042, migraron a Maps locales) -- ambos sin ningún consumidor real restante.
- Actualizados comentarios que referenciaban `ProjectControls.tsx` como pieza viva (`MisProyectos.tsx`, `Editor.tsx`) para reflejar el estado real; se dejaron sin tocar las referencias puramente históricas (`Button.tsx`/`InlineError.tsx`, explican el origen de una decisión pasada, no describen el presente).

Tests: 197/197 en verde (sin tests nuevos -- eliminación de UI/estado muerto, verificado en vivo). `npm run lint` y `npm run build` en verde (630 módulos, uno menos que antes).

Verificación en vivo (Claude in Chrome, local): navegación completa Mis proyectos → Set Nether (proyecto real) → Esqueleto (editor) -- el editor cargó normalmente, sin la fila/menú "💾 Proyecto" que antes vivía justo debajo del header. Búsqueda explícita confirmó que no existe ningún menú de proyecto standalone en el árbol de accesibilidad. Auditoría de código: `grep` de `'home'`/`ProjectControls`/`loadGeneration` en `frontend/src` confirma cero código muerto real (solo comentarios históricos). Sin errores en consola durante la carga ni la navegación.

Con este ticket se cierra el epic completo (034-045) de "Proyectos como concepto central + navegación nueva".

Sin hallazgos de QA pendientes.

## Nota de corrección (housekeeping)

Al cerrar este ticket la primera vez, el `## Hecho` se escribió por error en un archivo NUEVO con nombre ligeramente distinto (`045-retiro-flujo-edicion-libre-sin-proyecto.md`, con "flujo" de más) en vez de en este archivo original -- ese duplicado se movió a `done/` por error (PR #73) mientras este, el ticket real y trackeado desde la creación del backlog (034-045), se quedó sin cerrar en `pending/` (corregido en PR #74, que renombró/movió el archivo pero -- por un problema de sincronización entre un `git commit --amend` local y el merge remoto de GitHub -- mergeó a `dev` la versión SIN el `## Hecho` todavía). Esta segunda corrección agrega por fin el `## Hecho` real a este archivo, que es el correcto y definitivo. La implementación en sí (código, docs de arquitectura/componentes, PR #73) siempre fue correcta y correspondía a ESTE ticket -- los dos errores fueron puramente de bookkeeping del archivo de seguimiento, nunca del trabajo implementado.
