# 085 — Algoritmo de empaquetado UV genérico

## Objetivo
Generalizar el mapeo UV (hoy fijo en `applyBoxUV.ts` para las 4 geometrías conocidas) a un algoritmo de empaquetado (packing) que calcule offsets UV sin traslapes para un conjunto arbitrario de cajas -- pieza técnica central de la Etapa 2. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 6; "Diseño técnico").

## Criterios de aceptación (TDD)
- Dado un conjunto arbitrario de cajas con tamaños variados, el algoritmo devuelve offsets UV sin traslapes para todas ellas.
- Dadas las 4 geometrías vainilla existentes, el resultado del nuevo algoritmo no produce regresión visible respecto al layout UV actual (comparación explícita, no solo "corre sin error").
- Cobertura de tests unitarios para: una sola caja, muchas cajas, y tamaños muy dispares entre sí.

## Hecho
