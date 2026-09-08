# 089 — Extender AIAssistProvider a color (Etapa 3)

## Objetivo
Reusar el `AIAssistProvider` ya construido (ticket 088) para proponer una primera pasada de color sobre el atlas de textura ya definido, según una descripción de estilo. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 10; HU-8). Depende de los tickets 086 (editor de textura sobre modelo confirmado) y 088.

## Criterios de aceptación (TDD)
- Dado el editor de textura abierto, cuando elijo "Generar color con IA" (puente manual o automático) y confirmo una propuesta válida, el atlas se rellena, quedando disponible para seguir pintando encima con las herramientas existentes.
- Dado que ya pinté manualmente antes de pedir la propuesta, cuando la aplico, veo una confirmación explícita de que se sobreescribirá lo ya pintado, antes de que ocurra.

## Hecho

Implementado en la rama `feature/089-ai-assist-color`.

- **`frontend/src/geometry/packBoxesUV.ts`**: `groupPartsBySharedUV` pasa a `export` para reusarse en el módulo de color (evita pedirle a la IA un color redundante para partes que comparten UV, ej. `armRight`/`armLeft`).
- **`frontend/src/geometry/colorProposal.ts`** (nuevo, puro): `buildColorProposalPrompt(geometry, description)` arma el prompt pidiendo un color hex plano por cara de cada parte (dedupeando por grupo de UV compartido). `validateAndApplyColorProposal(raw, geometry, currentPixels, scale?)` valida a fondo la respuesta (parte existente en la geometría, cara conocida, color `#RRGGBB` válido) y rasteriza sobre una copia de `currentPixels` usando `computeBoxFaceRects` -- caras/partes omitidas quedan intactas.
- **`frontend/src/components/AIColorAssist.tsx`** (nuevo): mismos dos modos (Automático/Puente manual) que `AIGeometryAssist` (ticket 088), con confirmación explícita obligatoria antes de aplicar cualquier propuesta válida (HU-8, criterio 2).
- **`frontend/src/components/Editor.tsx`**: `AIColorAssist` wireado junto al selector de color; `handleApplyColorProposal` reusa el mecanismo de `handleImportFile` (`computeFullReplaceDiff` + `PaintHistory`) para que el reemplazo cuente como una sola unidad de deshacer.

**Desviación de alcance señalada explícitamente** (mismo criterio que el ticket 088): el objetivo hablaba de reusar un `AIAssistProvider` formal -- se mantuvo el mismo diseño de módulos puros + componente de dos modos, sin esa interfaz explícita, por la misma razón documentada en el ticket 088.

**Tests**: `frontend/test/colorProposal.spec.ts` (nuevo, 15 casos: dedupe del prompt por grupo, cada rechazo de validación, relleno exacto por cara sin tocar el resto, no-mutación del `PixelSource` de entrada, propagación a un group-mate, y el factor `scale` de resolución de trabajo). Suite completa: **307/307 tests en verde**. `tsc -b`, `oxlint` y `npm run build` sin hallazgos (mismo warning pre-existente de chunk grande por three.js).

**Verificación real, sin `GEMINI_API_KEY` configurada en este entorno local**: el modo automático se probó con los mocks ya existentes del ticket 087, y además en vivo en el navegador contra el backend real corriendo sin la variable configurada -- el mensaje de error del servidor ("La IA no esta configurada en este servidor (falta GEMINI_API_KEY).") se propagó correctamente hasta la UI. El modo puente manual se verificó end-to-end sobre la textura vainilla real del Zombie: descripción → copiar prompt → pegar una propuesta válida (color completo de `body` + solo la cara `front` de `head`/`armRight`/`legRight`) → mensaje de confirmación → "Aplicar sobre el atlas" → el atlas cambió exactamente en las caras indicadas, sin tocar las demás → **Ctrl+Z revirtió la propuesta completa en un solo paso**, confirmando la integración correcta con el historial de deshacer. Sin errores inesperados en la consola del navegador (solo el `console.warn` intencional del fallo esperado del modo automático).

Sin hallazgos pendientes del gate de QA automático al momento de escribir esto (se revisa de nuevo tras abrir el PR).
