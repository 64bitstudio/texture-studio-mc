# 082 — Modelo de datos: geometría custom, jerarquía y animaciones por mob

## Objetivo
Extender `ProjectRecord` para que cada mob de un proyecto pueda tener un `geometryStatus`, su propia `MobGeometry` custom (con `parentId` por caja) y un arreglo de animaciones, sin romper proyectos existentes -- base de datos para el resto del epic. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 3, "Diseño técnico").

## Criterios de aceptación (TDD)
- Proyectos guardados con el formato actual (sin `geometryStatus`) se siguen abriendo y editando sin cambios, tratados implícitamente como `vanilla`.
- Un mob dentro de un proyecto puede persistir `geometryStatus: 'vanilla' | 'modelando' | 'confirmado'`, su `MobGeometry` custom (cajas con `parentId?: string` opcional) y un arreglo `animations: Animation[]`, en el mismo `localStorage` de hoy.
- Tests unitarios cubren: la migración implícita de un proyecto viejo a `vanilla`, y la serialización/deserialización del nuevo shape sin pérdida de datos.

## Hecho
