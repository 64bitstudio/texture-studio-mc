# 082 — Modelo de datos: geometría custom, jerarquía y animaciones por mob

## Objetivo
Extender `ProjectRecord` para que cada mob de un proyecto pueda tener un `geometryStatus`, su propia `MobGeometry` custom (con `parentId` por caja) y un arreglo de animaciones, sin romper proyectos existentes -- base de datos para el resto del epic. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 3, "Diseño técnico").

## Criterios de aceptación (TDD)
- Proyectos guardados con el formato actual (sin `geometryStatus`) se siguen abriendo y editando sin cambios, tratados implícitamente como `vanilla`.
- Un mob dentro de un proyecto puede persistir `geometryStatus: 'vanilla' | 'modelando' | 'confirmado'`, su `MobGeometry` custom (cajas con `parentId?: string` opcional) y un arreglo `animations: Animation[]`, en el mismo `localStorage` de hoy.
- Tests unitarios cubren: la migración implícita de un proyecto viejo a `vanilla`, y la serialización/deserialización del nuevo shape sin pérdida de datos.

## Hecho

Implementado tal como se planeó, sin desviaciones de alcance:

- `MobBoxPart` (frontend y backend, espejo exacto) gana `parentId?: string`. Los 4 mobs vainilla no la usan todavía -- eso es el ticket 084.
- `projectStorage.ts` gana `GeometryStatus`, `AnimationKeyframe`, `MobAnimation`, y `ProjectMobEntry.geometryStatus?/customGeometry?/animations?` -- todo opcional y aditivo. Nueva `getMobGeometryStatus()` para no repetir el default `'vanilla'` en cada consumidor futuro.
- 4 tests nuevos en `test/projectStorage.spec.ts`: compatibilidad de un mob guardado antes de este ticket (sin `geometryStatus`), guardar/cargar geometría custom con jerarquía + animaciones sin pérdida de datos, estado `'modelando'`, y un proyecto con mobs mixtos (uno vanilla de siempre, otro custom).

**Tests corridos de verdad, todos en verde**: frontend 231/231 (`npx vitest run`), backend 17/17, lint limpio en ambos (`oxlint`), build de frontend exitoso (`tsc -b && vite build`, sin errores de tipos).

`docs/COMPONENTES.md` actualizado con la sección del ticket 082. No aplica revisión visual (sin UI en este ticket) ni Postman (sin endpoints nuevos -- el backend no persiste proyectos, solo sirve el catálogo vainilla). Sin hallazgos nuevos que valga la pena señalar más allá de los ya documentados en los tickets 080/081.
