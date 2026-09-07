# 087 — Endpoint backend proxy para llamadas a IA

## Objetivo
Construir un endpoint mínimo en el backend (`POST /api/ai/propose-geometry`, `/propose-color`, `/propose-animation`) que resguarde la API key de Gemini, para que el modo automático de asistencia de IA no la exponga en el navegador -- primera vez que el backend hace algo más que servir estáticos y el catálogo de mobs, cambio de alcance señalado y confirmado explícitamente con Marco. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 8; "Diseño técnico", decisión de seguridad).

## Criterios de aceptación (TDD)
- La API key de Gemini vive únicamente en variables de entorno del backend -- nunca se envía al frontend ni aparece en el bundle del cliente.
- Cada uno de los 3 endpoints recibe el payload correspondiente (geometría base + descripción / atlas + descripción / preset + descripción) y devuelve la respuesta de Gemini ya parseada, o un error claro y tipado.
- Tests de integración cubren el caso de éxito y el caso de cuota excedida/error de la API externa.

## Hecho
