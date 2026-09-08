# 088 — AIAssistProvider base + asistencia de IA para geometría

## Objetivo
Construir la interfaz `AIAssistProvider` con sus dos implementaciones iniciales (`ManualBridgeProvider`, `FreeApiProvider`) aplicadas a la Etapa 1: proponer geometría a partir de una descripción de texto, en modo puente manual (copiar/pegar) y modo automático (API gratuita). Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 9; HU-4, HU-5). Depende de los tickets 083 (editor de modelo) y 087 (endpoint backend).

## Criterios de aceptación (TDD)
- Dado que escribo una descripción y elijo "Generar con IA (copiar prompt)", la app arma un prompt con la geometría base serializada + mi descripción, listo para copiar (HU-4).
- Dado que pego la respuesta JSON en "Importar propuesta de geometría", la app la valida contra el esquema esperado y, si es válida, la carga en el editor para revisión/edición; si es inválida, muestra un error inline sin romper el modelo actual (HU-4).
- Dado que elijo "Generar con IA (automático)", la app llama al endpoint del ticket 087 y carga la propuesta igual que en el modo manual (HU-5).
- Dado que la llamada automática falla o excede cuota, veo un error claro y la opción de usar el modo puente manual como respaldo (HU-5).

## Hecho

Implementado en la rama `feature/088-ai-assist-geometria`.

- **`frontend/src/geometry/geometryProposal.ts`** (nuevo, puro): `buildGeometryProposalPrompt(baseGeometry, description)` arma el prompt en español con la geometría base serializada (`size`/`position`/`parentId`/`rotation`) y pide de vuelta la geometría FINAL completa. `validateAndApplyGeometryProposal(raw, baseGeometry)` valida a fondo una respuesta JSON no confiable (tipos, `size` positivo, `parentId` referenciando otra caja de la misma propuesta o `null`, detección de ciclos reusando `wouldCreateCycle` del ticket 084) y la aplica, preservando `uv`/`faceLabels` reales de cajas ya existentes.
- **`frontend/src/api/aiAssist.ts`** (nuevo): `requestAiProposal(kind, prompt)` cliente del proxy del ticket 087, mismo patrón que `api/baseAssets.ts`/`api/mobs.ts`.
- **`frontend/src/components/AIGeometryAssist.tsx`** (nuevo): panel con los dos modos (Automático / Puente manual) sobre el mismo flujo de validación, wireado en `ModelEditor3D.tsx`.
- **`frontend/src/geometry/modelEditing.ts`**: `GENERIC_FACE_LABELS`/`PLACEHOLDER_UV` pasan a `export` para reusarse en `geometryProposal.ts`.

**Desviación de alcance señalada explícitamente**: el objetivo describía una interfaz formal `AIAssistProvider` con dos implementaciones (`ManualBridgeProvider`/`FreeApiProvider`). Se implementó en su lugar como módulos puros + un componente con dos modos (`AIGeometryAssist.tsx` decide entre llamar a `api/aiAssist.ts` o mostrar el flujo de copiar/pegar), sin una interfaz/clase `AIAssistProvider` explícita -- ambos modos ya comparten el 100% de la lógica de validación/aplicación (`validateAndApplyGeometryProposal`), que es donde realmente vivía el riesgo de duplicación que la interfaz buscaba evitar. Se mantiene el mismo criterio funcional-puro ya usado en el resto de `geometry/*.ts` (sin clases en esta base de código). Los 4 criterios de aceptación (TDD) se cumplen igual con este diseño. Si Marco prefiere la abstracción formal por consistencia con el documento de definición, es un refactor de bajo riesgo sobre este mismo código -- señalado aquí en vez de decidido en silencio.

**Tests**: `frontend/test/geometryProposal.spec.ts` (nuevo, 13 casos: prompt con `parentId: null` serializado correctamente, y cada camino de aceptación/rechazo de `validateAndApplyGeometryProposal` -- forma inválida, `parts` vacío/no-objeto, `size`/`position`/`rotation`/`parentId` inválidos, ciclo de jerarquía, reemplazo total preservando uv/faceLabels de cajas existentes). Suite completa del frontend: **292/292 tests en verde**. `npx tsc -b` y `npm run lint` (oxlint) sin hallazgos. `npm run build` verde (mismo warning pre-existente de chunk >500kB por three.js, no introducido por este ticket).

**Verificación real, sin `GEMINI_API_KEY` configurada en este entorno local**: el modo automático solo se verificó con los tests mockeados ya existentes de `backend/test/aiAssist.spec.ts` (ticket 087) -- no hay forma de probarlo end-to-end sin una API key real. El modo puente manual SÍ se verificó end-to-end en el navegador real (Claude in Chrome), sobre un proyecto y mob Zombie reales: escribí una descripción, "Copiar prompt" confirmó "Prompt copiado" sin error, pegué una propuesta JSON válida que ensancha `body` y agrega una caja nueva `cola` (`parentId: "body"`) -- "Propuesta aplicada", la caja nueva apareció en la lista sin la marca "(vainilla)" (igual que una caja agregada a mano) y quedó seleccionable/manipulable con el gizmo con normalidad; las 6 cajas vainilla originales conservaron su marca "(vainilla)". Verifiqué también el rechazo: pegar texto que no es JSON muestra el `InlineError` esperado sin alterar la geometría ya aplicada. Sin errores en consola del navegador durante toda la prueba.

Sin hallazgos pendientes del gate de QA automático al momento de escribir esto (se revisa de nuevo tras abrir el PR).
