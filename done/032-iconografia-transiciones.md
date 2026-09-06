# 032 — Iconografía y transiciones (HU-7)

## Objetivo
Sale de `docs/definiciones/rediseno-ux-ui-y-navegacion.md` (HU-7). Se beneficia de que el resto del panel (025-031) ya esté con la nueva estructura de componentes antes de pulir encima.

## Alcance
- Íconos reconocibles junto al texto (nunca solo ícono, por accesibilidad) en los botones de acción principal: Deshacer, Rehacer, Borrar, Archivo, Guardar, Volver al inicio, y los que aplique del resto del panel.
- Transiciones cortas (~150-250ms) en cambios de estado visual: abrir/cerrar menú de Archivo, cambiar de mob, activar aislar-parte/modo borrar — respetando `prefers-reduced-motion`.

## Verificación
- En vivo (Claude in Chrome): confirmar visualmente que los botones principales tienen ícono + texto, y que las transiciones se sienten suaves (no instantáneas ni exageradamente lentas). Confirmar que con `prefers-reduced-motion: reduce` las transiciones se omiten/reducen.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado cualquier botón de acción principal, cuando se renderiza, entonces incluye ícono + texto.
- Dado un cambio de estado visual (menú, cambio de mob, activar un modo), cuando ocurre, entonces se anima con una transición corta, respetando `prefers-reduced-motion`.

## Hecho

Íconos (glifos Unicode, sin librería nueva -- mismo criterio "sin dependencias si no hace falta" del proyecto): ↶/↷ Deshacer/Rehacer, 🗑 Borrar, 📁 menú Archivo, 💾 menú Proyecto y botón Guardar, ← Volver al inicio. Cada glifo va en un `<span aria-hidden="true">` seguido del texto visible real -- verificado con `read_page` que el nombre accesible de cada botón lee limpio (sin el glifo duplicado). "Volver al inicio" era el único caso ícono-solo previo (`aria-label` sin texto visible) -- ahora tiene texto visible y pierde el `aria-label` redundante.

Transiciones: "modo borrar" y abrir/cerrar "Archivo"/"Proyecto" ya venían cubiertas gratis desde el ticket 025 (`.ui-button`/`.ui-menu__panel` ya usan `--transition-fast`, 150ms). Se agregó `.ts-fade-in` (nuevo, reusa el mismo token) para los dos casos que faltaban por ser fundidos-por-MONTAJE en vez de transición-por-cambio-de-propiedad: el contenedor raíz de `Editor` (remonta por completo al cambiar de mob, ticket 018) y el canvas de "aislar parte" (se monta/desmonta según la parte aislada). `prefers-reduced-motion` se respeta gratis reusando `--transition-fast` (ya zeroed bajo esa media query desde el ticket 025) en vez de un segundo mecanismo aparte.

Bug real encontrado y corregido en vivo (no hipotético -- confirmado con `getComputedStyle`): la primera versión de `.ts-fade-in` escribía `animation: ts-fade-in var(--transition-fast) ease`, pero `--transition-fast` YA incluye el easing (`150ms ease`) -- el shorthand resultante (`ts-fade-in 150ms ease ease`, con DOS funciones de easing) es inválido y el navegador descartaba toda la declaración (`animation: none` real, no solo sospechado). Corregido quitando el `ease` sobrante; reverificado con `getComputedStyle` mostrando `animation: 0.15s ts-fade-in` en ambos elementos.

Tests: 169/169 en verde (sin tests nuevos -- cambios puramente visuales/CSS, verificados en vivo en vez de con tests unitarios), `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): confirmé visualmente los 6 controles listados con ícono+texto (captura de pantalla); confirmé con `read_page` que los nombres accesibles no duplican el glifo; confirmé con `getComputedStyle`/`querySelectorAll('.ts-fade-in')` que el contenedor de `Editor` y el canvas de aislar-parte reciben la animación real (no solo visualmente plausible).

Sin hallazgos de QA pendientes ni recortes de alcance.
