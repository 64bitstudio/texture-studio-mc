# 011 — Regiones UV nombradas + indicadores visuales en la cuadrícula

## Objetivo
Sale de feedback directo de Marco: quiere que la cuadrícula tenga indicadores de qué región representa cada zona (ej. "la cara", "los laterales") para facilitar pintar sin adivinar. Inspirado en cómo Blockbench resalta la cara de UV seleccionada en su editor (ver `docs/definiciones/...` no aplica — este es un ticket nuevo sin HU previa, ver investigación abajo).

## Investigación
[Blockbench](https://blockbench.org/blockbench-uv-editor-tutorial-basics-to-advanced/) resalta la cara del cubo seleccionada en su UV Editor y permite pintar tanto ahí como sobre el modelo 3D. No copiamos su UI completa (fuera de alcance), solo el principio: cada región de la textura debe poder identificarse sin adivinar.

## Alcance
1. Extender el contrato de geometría (`backend/src/geometry/skeletonGeometry.ts` / `SkeletonBaseAssetsResponse`) con un nombre legible por caja+cara, ej.:
   - `head`: `front` = "Cara", `back` = "Nuca", `top` = "Parte superior", `bottom` = "Parte inferior", `left`/`right` = "Lateral izquierdo/derecho".
   - `body`: `front` = "Pecho", `back` = "Espalda", `left`/`right` = "Costado izquierdo/derecho".
   - `armRight`/`armLeft`/`legRight`/`legLeft`: análogo ("Brazo derecho — frente", etc.).
2. En el editor de textura, al pasar el cursor sobre una celda, mostrar (tooltip o etiqueta fija en un panel) el nombre de la región bajo el cursor.
3. Dibujar un overlay sutil (líneas más marcadas que la cuadrícula normal) delimitando cada región nombrada, para que sean visualmente distinguibles sin necesidad de hover.

## Qué NO construir (fuera de este ticket)
- No implementes selección/aislamiento de partes todavía (eso es el ticket 012, que depende de este).
- No pintes directamente sobre el modelo 3D (como permite Blockbench) — sigue siendo fuera de alcance, el pintado ocurre solo en la cuadrícula 2D.

## Criterios de aceptación
- Dado el editor de textura, cuando el cursor pasa sobre cualquier pixel, entonces se identifica claramente a qué región nombrada pertenece.
- Dado el overlay de regiones, cuando se activa/consulta, entonces las fronteras entre regiones distintas (ej. cabeza vs. torso, frente vs. lateral) son visualmente claras.

## Hecho
Implementado por el agente `fullstack-dev` (PR [#23](https://github.com/64bitstudio/texture-studio-mc/pull/23)). CI de Jenkins en verde, sin hallazgos del gate de QA automático.

- Catálogo de nombres definido y expuesto en `GET /api/base-assets/skeleton` (`faceLabels` por caja, cambio aditivo al contrato): Cabeza (Cara/Nuca/Parte superior/Parte inferior/Lateral izquierdo/derecho), Torso (Pecho/Espalda/Costado izquierdo/derecho), Brazo/Pierna ("Brazo — Frente/Atrás/...", sin lateralidad — ver nota abajo).
- `frontend/src/regionLabels.ts`: módulo puro y reusable (`computeNamedRegions`/`findRegionAt`) — el ticket 012 lo consume directamente, sin redefinir el catálogo.
- Etiqueta fija "Región: `<nombre>`" sobre el editor + overlay de fronteras (líneas de 2px) siempre visible, en un canvas separado.
- **Decisión del agente, aceptada**: `armRight`/`armLeft`/`legRight`/`legLeft` no llevan lateralidad en su label (ej. "Brazo — Lateral", no "Brazo derecho — Lateral") porque ambas partes comparten literalmente la misma región UV (un pixel pintado ahí afecta a los dos lados) — decir "derecho" sería engañoso. Correcto, se mantiene así.
- **Verificado en vivo contra el deploy real de DEV** (el orquestador repitió la verificación tras el merge, con eventos de puntero reales y lectura directa de `getImageData`): hover sobre distintas zonas de la cuadrícula devuelve el nombre correcto (Cara, Parte superior, Pecho, Costado izquierdo/derecho, Brazo/Pierna — Lateral, "—" fuera de toda región); pintar en la región "Cara" aparece exactamente en la cara del cráneo del modelo 3D; overlay de fronteras (líneas amarillas) claramente visible.
- Pendiente, explícitamente fuera de este ticket: aislar partes (012), pegado con ajuste automático (013).
