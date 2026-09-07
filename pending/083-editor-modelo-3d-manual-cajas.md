# 083 — Editor de modelo 3D manual (agregar/mover/redimensionar/eliminar cajas)

## Objetivo
Construir el editor de modelo 3D (Etapa 1): elegir un mob vainilla como base y agregar/mover/redimensionar/rotar/eliminar cajas con gizmos sobre el visor 3D existente -- sin jerarquía ni IA todavía (tickets aparte). Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 4; HU-1, HU-2). Depende del ticket 082.

## Criterios de aceptación (TDD)
- Dado que agrego un mob a un proyecto, cuando confirmo la selección, entro al editor de modelo con la geometría vainilla de ese mob ya cargada como base editable (HU-1).
- Dado el editor de modelo abierto, cuando agrego una caja nueva, aparece en el visor 3D con gizmos para mover/redimensionar/rotar, con tamaño/posición por defecto razonable, sin superponerse a otra caja (HU-2).
- Dado que elimino una caja que no es parte de la geometría vainilla original, cuando confirmo, desaparece sin afectar las demás (HU-2).
- Dado que muevo/redimensiono cualquier caja, el cambio se refleja de inmediato en el visor 3D (HU-2).

## Hecho
