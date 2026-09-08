# 091 — Extender AIAssistProvider a animación

## Objetivo
Extender el `AIAssistProvider` a la Etapa 4 en dos niveles de confianza: HU-11 (ajuste de parámetros de un preset) y HU-12 (keyframes libres). Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 12; HU-11, HU-12). Depende de los tickets 087, 090.

**Actualizado tras el spike 081 (ejecutado y cerrado, ver `done/081-spike-calidad-ia-animacion.md`)**: la calidad de contenido de ambos proveedores (Claude vía puente manual, Gemini vía API) sostiene construir **tanto HU-11 como HU-12 en esta versión** -- ya no es condicional. El spike sí encontró dos ajustes de diseño obligatorios, incorporados abajo: (a) el modo automático necesita reintentos con backoff antes de reportar falla (el free tier de Gemini falló ~20% de las llamadas en la prueba, incluso con reintentos), y (b) el umbral de "salto máximo entre keyframes" debe escalar con la duración de la animación, no ser una constante fija (marcaba falsos positivos en animaciones rápidas/rígidas pedidas a propósito).

## Criterios de aceptación (TDD)
- Dado que elijo un preset y describo el estilo deseado, la IA devuelve valores de parámetros (no keyframes libres) dentro de los rangos válidos del preset, aplicados de inmediato para previsualizar (HU-11).
- Dado que los parámetros devueltos están fuera de rango, la app los recorta a los límites válidos antes de aplicarlos, sin error visible (HU-11).
- Dado que ajusto los sliders manualmente después de una propuesta de IA, el comportamiento es idéntico a haber elegido esos valores desde el inicio (HU-11).
- Dado que describo una animación libre y recibo una propuesta válida, se carga como keyframes editables en el timeline sin reemplazar animaciones existentes de otro nombre; descartar la propuesta deja el timeline como estaba (HU-12).
- Dado que el modo automático (Gemini) falla con un error transitorio (503/timeout/429), la app reintenta al menos 2-3 veces con backoff antes de mostrar el mensaje de error y ofrecer el modo puente manual -- un solo fallo no debe rendirse de inmediato (hallazgo del spike 081).
- Dado un umbral de "salto máximo entre keyframes" para marcar advertencias de coherencia, el umbral se calcula en función de la duración/velocidad de la animación pedida (no es una constante fija en grados/segundo) -- evita marcar como sospechosas animaciones rápidas o rígidas pedidas intencionalmente (hallazgo del spike 081).
- Keyframes con saltos bruscos (según el umbral ajustado) o cierre de loop incompatible se marcan visualmente sin bloquear la importación (HU-12).

## Hecho

Implementado en la rama `feature/091-ai-assist-animacion`.

- **`frontend/src/animation/presets.ts`**: nueva `PRESET_PARAMS_RANGE` + `clampPresetParams`, única fuente de verdad para los sliders manuales y el recorte de una propuesta de IA.
- **`frontend/src/animation/aiAnimationProposal.ts`** (nuevo, puro): `buildPresetParamsPrompt`/`validateAndClampPresetParams` (HU-11, recorta en vez de rechazar) y `buildFreeAnimationPrompt`/`validateFreeAnimationProposal` (HU-12, validación de esquema estricta + advertencias de coherencia no bloqueantes: salto angular máximo -- 720°/s, escala con la duración pedida -- y cierre de loop incompatible).
- **`frontend/src/components/AIPresetParamsAssist.tsx`** (nuevo): asistencia de IA para HU-11, aplica de inmediato sobre el mismo estado que los sliders manuales.
- **`frontend/src/components/AIFreeAnimationAssist.tsx`** (nuevo): asistencia de IA para HU-12, con flujo de confirmación explícita (aplicar/descartar) antes de tocar el timeline.
- **`frontend/src/components/AnimationEditor.tsx`**: ambos componentes wireados en el panel lateral.

**Reintentos con backoff (hallazgo del spike 081)**: ya implementados y verificados desde el ticket 087 (`backend/src/services/aiAssist.ts`, hasta 3 intentos con backoff exponencial) -- el endpoint `/api/ai/propose-animation` los usa automáticamente, nada nuevo que construir aquí.

**Tests**: `frontend/test/aiAnimationProposal.spec.ts` (nuevo, 16 casos: HU-11 acepta/recorta/rechaza, HU-12 cada rechazo de esquema + coherencia -- salto brusco marcado, swing rápido pedido a propósito NO marcado, cierre de loop incompatible marcado, orden de keyframes). Suite completa: **362/362 tests en verde**. `tsc -b`, `oxlint`, `npm run build` sin hallazgos.

**Verificación real, sin `GEMINI_API_KEY` configurada en este entorno local**: modo automático de ambas HUs probado en vivo contra el backend real sin la variable -- error claro propagado a la UI en los dos casos. Modo puente manual verificado end-to-end: HU-11, `{"speed": 999, "amplitude": -5}` se recortó a `(3.00, 5°)` y movió los sliders sin error visible; HU-12, una propuesta con un salto intencional de 170° en 0.05s mostró la advertencia de coherencia esperada -- **Descartar** dejó el timeline intacto (`walk`/`idle` sin cambios), y aplicar en un segundo intento agregó la animación (marcada "solo disparable manualmente", nombre no reconocido) con sus keyframes ya editables en el timeline manual. Sin errores en consola.

Sin hallazgos pendientes del gate de QA automático al momento de escribir esto (se revisa de nuevo tras abrir el PR).
