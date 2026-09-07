# 081 — Spike: calidad de IA proponiendo animación

## Objetivo
Evaluar con datos reales qué tan usable es una IA (Gemini gratuito y/o Claude vía puente manual) proponiendo parámetros/keyframes de una animación simple, para decidir con evidencia si HU-12 (keyframes libres, experimental) entra en la primera versión del epic o se pospone. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 2; HU-11/HU-12; "Riesgos y preguntas abiertas"). Puede correr en paralelo al ticket 080.

## Criterios de aceptación (TDD)
- Se corren al menos 5 prompts de prueba pidiendo un ciclo de caminar simple sobre una jerarquía de huesos tipo biped, tanto en modo puente manual (Claude/ChatGPT) como con la API gratuita de Gemini.
- Se documentan los resultados: calidad subjetiva del movimiento, tasa de errores de formato/esquema, y coherencia temporal (saltos bruscos, cierre de loop).
- El ticket cierra con una recomendación explícita en su sección "Hecho": construir HU-12 en esta versión, posponerla, o ajustar su alcance -- y si cambia el alcance de HU-11/HU-12, se refleja como actualización al documento de definición.

## Hecho
