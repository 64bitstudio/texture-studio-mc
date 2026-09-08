# 081 — Spike: calidad de IA proponiendo animación

## Objetivo
Evaluar con datos reales qué tan usable es una IA (Gemini gratuito y/o Claude vía puente manual) proponiendo parámetros/keyframes de una animación simple, para decidir con evidencia si HU-12 (keyframes libres, experimental) entra en la primera versión del epic o se pospone. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 2; HU-11/HU-12; "Riesgos y preguntas abiertas"). Puede correr en paralelo al ticket 080.

## Criterios de aceptación (TDD)
- Se corren al menos 5 prompts de prueba pidiendo un ciclo de caminar simple sobre una jerarquía de huesos tipo biped, tanto en modo puente manual (Claude/ChatGPT) como con la API gratuita de Gemini.
- Se documentan los resultados: calidad subjetiva del movimiento, tasa de errores de formato/esquema, y coherencia temporal (saltos bruscos, cierre de loop).
- El ticket cierra con una recomendación explícita en su sección "Hecho": construir HU-12 en esta versión, posponerla, o ajustar su alcance -- y si cambia el alcance de HU-11/HU-12, se refleja como actualización al documento de definición.

## Hecho

Spike ejecutado con datos reales de ambos proveedores (no supuestos), 5 prompts de prueba pidiendo un ciclo de "walk" sobre la jerarquía biped ya confirmada en el ticket 080 (`body` raíz, `head`/`armRight`/`armLeft`/`legRight`/`legLeft` hijas), validados con las mismas reglas automáticas ya diseñadas (esquema, rango de rotación, velocidad angular máxima entre keyframes, cierre de loop). Scripts y respuestas crudas en `done/081-assets/` (la API key de Gemini se usó solo en memoria vía variable de entorno, nunca se guardó en ningún archivo).

### Resultados

| | Claude (puente manual) | Gemini 3.6 Flash (API gratuita) |
|---|---|---|
| Respondió | 5/5 | 4/5 (1 agotó 4 reintentos con backoff y nunca respondió) |
| Esquema válido (de las que respondieron) | 4/5 (1 typo real: hueso `legRigth`) | 4/4 |
| Advertencias de coherencia (velocidad angular) | 2/5 | 1/4 |
| Fallos de infraestructura observados | 0 | 503 (sobrecarga), timeout, y un 429 (rate limit) -- en solo ~13 llamadas totales de esta sesión de prueba |

### Hallazgos

1. **La calidad del contenido no es el problema** -- ambos proveedores generan animaciones estructuralmente coherentes que reflejan bien la descripción pedida (asimetría real en "cojeando", rigidez real en "robótica", cadencia más rápida en "trote"). Esto **confirma que HU-12 (keyframes libres) es viable para la v1**, no hay que posponerla.
2. **El error real que sí ocurrió (typo de hueso) fue atrapado por la validación de esquema ya diseñada** -- funcionó exactamente como debía, sin necesitar ajustes.
3. **El chequeo de "velocidad angular máxima" (umbral fijo en grados/segundo) marca falsos positivos en animaciones rápidas/rígidas a propósito** (trote, robótica) -- confirmado con ambos proveedores. Hallazgo de diseño: el umbral debe escalar con la duración/velocidad pedida de la animación, no ser un número fijo. Ya era una advertencia no-bloqueante en el diseño original, así que no rompe nada, pero conviene afinarlo antes de implementar el ticket 091.
4. **Hallazgo crítico nuevo, no anticipado**: el free tier de Gemini tuvo una tasa de fallo de infraestructura real y significativa (503/timeout/429) en una sesión de prueba corta -- muy por encima de lo que un usuario esperaría de un botón "Generar con IA" dentro de la app. **Impacto directo en el ticket 091 y en el endpoint del ticket 087**: el modo automático necesita reintentos con backoff (ya implementados y verificados en el script de prueba) antes de rendirse y mostrar el mensaje de "usa el puente manual como respaldo" que ya estaba planeado -- un solo intento fallido no debe considerarse "la IA no funcionó".

### Recomendación explícita

- **Construir tanto HU-11 (ajuste de parámetros de preset) como HU-12 (keyframes libres) en la v1** -- ya no hay que esperar más evidencia, la calidad de ambos proveedores lo sostiene.
- Ajustar el diseño técnico de HU-12 (y del validador compartido con HU-4/HU-8) para que el umbral de "salto máximo" escale con la duración de la animación en vez de ser una constante.
- Agregar reintentos con backoff (mínimo 2-3 intentos) al endpoint del ticket 087 antes de reportar falla al usuario -- actualizado directamente en `pending/091-ai-assist-animacion.md` y en el documento de definición.
- El puente manual (Claude/ChatGPT) debe presentarse como la opción **igual de válida por defecto**, no como un respaldo de segunda clase -- tuvo cero fallos de infraestructura en esta prueba, a diferencia del modo automático.

No se escribió código de producción de `texture-studio-mc` en este ticket (spike de evaluación, sin UI ni endpoints propios todavía). No aplican tests automatizados del proyecto ni cambios de Postman/UI.
