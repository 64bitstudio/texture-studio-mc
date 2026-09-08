# 084 — Jerarquía padre-hijo entre cajas (huesos)

## Objetivo
Permitir declarar una caja como "hija" de otra dentro del editor de modelo, con una jerarquía por defecto ya cargada para los 4 mobs vainilla, y sin permitir ciclos. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 5; HU-3; "Diseño técnico"). Depende del ticket 083.

## Criterios de aceptación (TDD)
- Dado el editor de modelo abierto, cuando asigno una caja como hija de otra, el visor 3D refleja la relación (mover/rotar el padre arrastra visualmente a la hija en la previsualización).
- Dado un modelo recién creado a partir de un mob vainilla, cuando lo abro, ya trae la jerarquía por defecto sin acción del usuario: Esqueleto/Zombie con `body` raíz y `head`/`armRight`/`armLeft`/`legRight`/`legLeft` como hijas; Araña con `thorax` raíz y `head`/`abdomen`/las 8 patas como hijas; Creeper con `body` raíz y `head`/las 4 patas como hijas.
- Dado que intento asignar una caja como hija de sí misma o de uno de sus propios descendientes, la app lo rechaza con un mensaje claro.

## Hecho

Implementado con una decisión de diseño necesaria (no especificada literalmente por el ticket, pero sin la cual "mover el padre arrastra a la hija" sería solo cosmético): una caja con `parentId` pasa a tener `position`/`rotation` relativos a su padre (no absolutos), mismo patrón ya establecido por `pivot`/`rotation` (ticket 024) -- ver `geometry/hierarchy.ts` para el razonamiento completo.

- `geometry/hierarchy.ts` (puro): `computeAbsolutePosition`, `getDescendants`, `wouldCreateCycle`, `setParent` (convierte automáticamente absoluta↔relativa, valida ciclos), `getDefaultParentMap`/`applyDefaultHierarchy` (jerarquía por defecto de los 4 mobs vainilla). 21 tests nuevos.
- `geometry/geometryBounds.ts`: `computeAllPartCorners`/`computeGeometryBounds` ahora resuelven posición absoluta vía la cadena de padres antes de calcular esquinas -- sin regresión para los 4 mobs vainilla (mismos tests ya existentes en verde).
- `components/ModelEditor3D.tsx`: reescrito para anidar `<group>` de three.js por jerarquía (mover/rotar el padre arrastra a los hijos gratis, vía el propio scene graph). Aplica la jerarquía por defecto automáticamente al abrir un mob vainilla sin jerarquía todavía. Nuevo selector "Padre" por caja -- sus opciones ya excluyen a la propia caja y sus descendientes, así que la UI previene la mayoría de los ciclos antes de que ocurran (mejor UX que solo rechazar después); `setParent` sigue validando como defensa en profundidad.
- **Hallazgo real, encontrado extendiendo el ticket 083 (señalado explícitamente, no oculto)**: `App.tsx` siempre re-fetcheaba la geometría vainilla al abrir "Editar modelo 3D", descartando en silencio cualquier `customGeometry` guardada de una sesión anterior. Corregido: ahora revisa primero si ya existe `customGeometry` para ese mob.

**Tests corridos de verdad, todos en verde**: frontend 274/274 (`npx vitest run`), lint limpio (sin warnings, incluido el `set-state-in-effect` que apareció al principio y se corrigió moviendo la resolución síncrona al event handler), `tsc -b` y `vite build` exitosos.

**Revisión visual en vivo** (regla del equipo): levanté los servidores y probé con Claude in Chrome sobre un proyecto Creeper real -- confirmé que la jerarquía por defecto se carga sola (`body` raíz, el resto con "Padre: body", sin ninguna acción del usuario), que arrastrar `body` mueve la cabeza y las 4 patas junto con él, y que arrastrar `head` (hija) por separado NO mueve al `body` ni a las demás patas -- ambos sentidos del comportamiento verificados en el navegador real. El rechazo de ciclos no se pudo demostrar por UI porque la propia UI ya lo previene filtrando las opciones del selector "Padre" (diseño deliberado) -- queda cubierto por 3 tests unitarios dedicados en `hierarchy.spec.ts` en su lugar.

**Nota de arrastre real durante la revisión**: los primeros 2 intentos de arrastrar el gizmo con el mouse automatizado no movieron nada (limitación conocida de simular drags finos sobre WebGL, similar al hallazgo de "Context Lost" del ticket 083) -- funcionó correctamente al reintentar con coordenadas más precisas sobre el eje del gizmo.

**Nota de alcance, no bloqueante**: escalar el `<group>` de un padre durante el arrastre en vivo también escala visualmente a sus hijos mientras se arrastra (se autocorrige al soltar, ya que el tamaño final se aplica a la caja individual). Separar esto correctamente requeriría un grupo intermedio extra por caja -- fuera de alcance de este ticket, documentado en `docs/COMPONENTES.md`.

No aplica Postman (sin endpoints nuevos).
