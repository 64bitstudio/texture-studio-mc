# 008 — Corregir distorsión de texeles no cuadrados en el editor

## Objetivo
Sale de un hallazgo real documentado al cerrar el ticket 005 (`docs/ARQUITECTURA.md`, sección del ticket 005) — no de una HU de `docs/definiciones/editor-3d-texturas-esqueleto.md`. El `<canvas>` de `TextureEditor` (tickets 002/004) puede renderizar texeles no cuadrados porque `max-width: 100%` lo comprime dentro del `<aside>` de ancho fijo (280px) sin ajustar la altura en proporción — esto ocurre con el estado por defecto (zoom 1000%), no es un caso raro.

**Nota:** esto no bloqueó el ticket 005 — el overlay de pegar imagen (HU-9) ya compensa la distorsión midiendo la escala real renderizada vía `ResizeObserver`. Este ticket es puramente sobre la distorsión VISUAL del propio editor (los pixeles se ven rectangulares en vez de cuadrados), que afecta la percepción de precisión al pintar.

## Alcance
Elegir e implementar una de las opciones ya identificadas (o una equivalente mejor):
- Ensanchar el `<aside>`/sidebar para que quepa el editor sin comprimirse.
- Bajar el nivel de zoom por defecto (`ZOOM_DEFAULT` en `frontend/src/zoom.ts`) para que quepa sin comprimirse al ancho actual.
- Usar `aspect-ratio` real (CSS) en vez de solo `max-width: 100%`, dejando que el editor decida su propia altura en función del ancho disponible y la proporción real 64:32.

Requiere una decisión de diseño (impacto en layout general de la app) — no asumir cuál opción sin confirmar, ya que afecta el resto de componentes del sidebar (`ColorPicker`, `HistoryControls`, `SymmetryControls`, `ZoomControls`, `GridToggle`, controles de importar/pegar).

## Criterios de aceptación
- Dado el editor en su estado por defecto (zoom inicial), cuando se mide el tamaño renderizado de un texel individual, entonces su ancho y alto en pixeles de pantalla son iguales (dentro de un margen de redondeo de 1px).
- Dado cualquier nivel de zoom soportado, cuando se redimensiona la ventana, entonces los texeles se mantienen cuadrados (no solo en el tamaño inicial).
