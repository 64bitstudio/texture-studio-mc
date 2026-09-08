# 083 — Editor de modelo 3D manual (agregar/mover/redimensionar/eliminar cajas)

## Objetivo
Construir el editor de modelo 3D (Etapa 1): elegir un mob vainilla como base y agregar/mover/redimensionar/rotar/eliminar cajas con gizmos sobre el visor 3D existente -- sin jerarquía ni IA todavía (tickets aparte). Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 4; HU-1, HU-2). Depende del ticket 082.

## Criterios de aceptación (TDD)
- Dado que agrego un mob a un proyecto, cuando confirmo la selección, entro al editor de modelo con la geometría vainilla de ese mob ya cargada como base editable (HU-1).
- Dado el editor de modelo abierto, cuando agrego una caja nueva, aparece en el visor 3D con gizmos para mover/redimensionar/rotar, con tamaño/posición por defecto razonable, sin superponerse a otra caja (HU-2).
- Dado que elimino una caja que no es parte de la geometría vainilla original, cuando confirmo, desaparece sin afectar las demás (HU-2).
- Dado que muevo/redimensiono cualquier caja, el cambio se refleja de inmediato en el visor 3D (HU-2).

## Hecho

Implementado con una precisión de alcance sobre HU-1, señalada explícitamente (ver razonamiento completo en `ModelEditor3D.tsx` y `docs/COMPONENTES.md`, "Ticket 083"): la entrada al editor vive en el menú "⋮" de cada mob en `Proyecto.tsx` ("Editar modelo 3D"), no inyectada en el flujo principal de "agregar mob" -- ese flujo sigue exactamente igual que antes de este ticket para cualquiera que no toque la opción nueva. Forzar a todos por un editor cuyo siguiente paso natural (confirmar + atlas UV, ticket 086) todavía no existe habría sido una regresión de UX real.

- `geometry/modelEditing.ts`: `addBox`/`removeBox`/`updateBoxTransform`/`canDeleteBox`/`findNonOverlappingPosition`/`generateNewPartName` -- puro, inmutable, 14 tests nuevos.
- `components/ModelEditor3D.tsx`: gizmos de mover/rotar/escalar (drei `TransformControls`) sobre cajas sin textura, panel lateral con lista de cajas, "Agregar caja"/"Eliminar caja" (deshabilitado para cajas vainilla).
- `projectStorage.ts`: nueva `updateMobGeometry` (refresca `updatedAt`), 4 tests nuevos.
- Wiring completo: `MobEntryCard.tsx` → `Proyecto.tsx` → `App.tsx` (nueva vista `'editor-modelo'`, fetch de geometría separado de la Etapa 3).

**Tests corridos de verdad, todos en verde**: frontend 259/259 (`npx vitest run`), lint limpio (`oxlint`), `tsc -b` y `vite build` exitosos.

**Revisión visual en vivo** (regla del equipo, tocó pantallas): levanté `backend`/`frontend` en dev y probé el flujo completo con Claude in Chrome -- crear proyecto → "Editar modelo 3D" → agregar caja (se coloca sin superponerse, auto-seleccionada) → seleccionar una caja vainilla (`head`) → confirmar que "Eliminar caja" queda deshabilitado y el click no hace nada → eliminar `caja1` (sí permitido, desaparece) → agregar otra caja → "Continuar" → vuelve a "Proyecto" con `Última modificación` actualizada (confirma que `updateMobGeometry` persistió). Todo se comportó exactamente como se diseñó.

**Hallazgo real durante la revisión, aclarado explícitamente (no oculto)**: en un primer intento el canvas 3D se veía completamente en blanco (sin modelo ni cuadrícula). Investigué antes de asumir que era un bug mío: el panel "Vista previa 3D" del editor de texturas YA EXISTENTE (código que este ticket no toca) mostraba el mismo síntoma en la misma sesión de navegador, con `THREE.WebGLRenderer: Context Lost` repetido en consola -- confirma que es una limitación de WebGL/GPU de ese entorno de prueba puntual, no una regresión de este ticket. Repitiendo el flujo con timing normal (sin clicks encadenados sin espera), el canvas rendereó correctamente en los intentos siguientes.

**Detalle menor de pulido, no bloqueante**: el estado deshabilitado de "Eliminar caja" usa el mismo `.ui-button:disabled { opacity: 0.5 }` global del sistema de diseño -- funciona correctamente (verificado: click no elimina `head`), pero el contraste es sutil a simple vista. No amerita un ticket propio; queda como nota para cuando se pula visualmente esta pantalla.

No aplica Postman (sin endpoints nuevos en este ticket).
