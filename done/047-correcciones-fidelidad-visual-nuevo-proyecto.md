# 047 — Correcciones de fidelidad visual (topbar/sidebar/Nuevo proyecto)

## Objetivo
Sigue directo del ticket 046 (rediseño visual). Marco revisó el resultado en vivo y pidió una segunda pasada de corrección: "todos los estilos son acercados pero no son idénticos" -- alcance explícitamente **solo visual**, mismas 3 áreas (topbar/sidebar/"Nuevo proyecto"), esta vez verificado con muestreo de píxeles real sobre la imagen de referencia (Python/PIL) en vez de a ojo.

Pedido textual de Marco (verbatim, resumido):
- "Nuevo proyecto" debe ocupar todo el ancho disponible (tenía `maxWidth`).
- "Crear proyecto" va debajo de la tarjeta "Vista previa" (estaba debajo de "Selecciona un mob").
- El ícono del botón "Crear proyecto" es incorrecto.
- "Todos los íconos no tienen el estilo correcto".
- La etiqueta "Minecraft Java Edition" no es exactamente igual.
- El input de nombre no se ve correcto.
- Marco proveyó 2 assets reales para asignar directamente: el fondo del sidebar y el logo de la app (antes aproximados con CSS/SVG a mano).

## Alcance
- Recortar y limpiar los 2 assets que mandó Marco (fondo del sidebar con degradado de píxeles verdes, logo con glow de neón) y usarlos como archivos reales del proyecto (`assets/brand/`), reemplazando el gradiente CSS aproximado y el ícono SVG hecho a mano.
- Re-muestrear colores exactos de la imagen de referencia original (background, acento, chip, bordes) con Python/PIL en vez de aproximar a ojo -- actualizar tokens de `index.css`.
- Rediseñar el set de íconos (`ui/icons.tsx`) -- la referencia mezcla íconos de TRAZO fino (carpeta/reloj/ojo/info/limpiar) e íconos RELLENOS/sólidos (sol/engranaje/más/cubo) -- la revisión 1 los había hecho todos de trazo fino.
- `NuevoProyecto.tsx`: quitar `maxWidth`, mover "Crear proyecto" a una segunda fila del grid (debajo de "Vista previa"), ícono del botón como círculo oscuro con "+" verde adentro, encabezados de sección sin caja alrededor del ícono, badge "Minecraft Java Edition" como chip sólido (no pastilla con borde), input con fondo/borde corregidos, tarjetas de mob más grandes.

## Qué NO hacer
- Mismo alcance de 3 áreas del ticket 046 -- no se extiende a `AgregarMobs`/`MobSelector`/`Mis proyectos`/`Recientes`/`Proyecto`/`Editor`/`Settings`.

## Verificación
- En vivo (Claude in Chrome, ambos temas): comparación directa contra la imagen de referencia con recortes ampliados de zonas específicas (íconos, badge, botón, input) para confirmar coincidencia real, no aproximada.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que abro "Nuevo proyecto" en una pantalla ancha, cuando veo el layout, entonces ocupa todo el ancho disponible.
- Dado que veo el botón "Crear proyecto", entonces está debajo de la tarjeta "Vista previa", con un ícono en círculo oscuro.
- Dado que comparo cada ícono contra la referencia, entonces coincide en estilo (trazo vs. relleno según corresponda).
- Dado que veo el sidebar, entonces usa el PNG real de Marco como fondo y como logo, no una aproximación.

## Hecho

Implementado tal como estaba alcanzado, con muestreo de píxeles real (Python/PIL) contra la imagen de referencia original en vez de aproximar a ojo -- ver `docs/ARQUITECTURA.md`, "Ticket 047" para el detalle técnico completo:

- **Assets reales**: `assets/brand/sidebar-bg.png` (recorte limpio del fondo que mandó Marco, sin esquinas redondeadas) y `assets/brand/logo.png` (con transparencia real, el patrón de cuadros del archivo original se convirtió a alpha=0). `IconGrassBlockLogo` eliminado.
- **Tokens re-muestreados**: `--bg`/`--panel-bg` a `#0f171d` (iguales entre sí -- una tarjeta se distingue solo por su borde en la referencia), `--accent` a `#60ef9b`, nuevo `--chip-bg`.
- **Set de íconos**: mezcla real de trazo fino (carpeta/reloj/ojo/info/limpiar) y forma rellena (sol/engranaje/más/cubo) -- confirmado con recortes ampliados, no era un único estilo como asumió la revisión 1.
- **`NuevoProyecto.tsx`**: sin `maxWidth`; "Crear proyecto" en segunda fila del grid bajo "Vista previa"; ícono del botón en círculo oscuro; encabezados sin caja; badge como chip sólido; input con fondo/borde corregidos; tarjetas de mob más grandes.
- **Dos bugs reales encontrados en vivo** (tema claro): el sidebar usa un fondo SIEMPRE oscuro (asset fijo) pero su texto seguía `var(--text)` -- ilegible en tema claro, corregido con colores fijos (`SIDEBAR_TEXT`/`SIDEBAR_TEXT_DIM`). `.ui-button--primary` tenía `color: var(--bg)` en un borrador intermedio -- hubiera sido casi invisible en tema claro, corregido a un oscuro fijo antes de verificar.
- **Hallazgo adicional en vivo**: la tarjeta de marca del pie del sidebar se veía demasiado transparente sobre la zona más intensa del degradado verde -- se subió su opacidad de fondo de 0.55 a 0.88.

Tests: 197/197 en verde (sin tests nuevos -- cambio 100% visual/presentacional). `npm run lint` y `npm run build` en verde (638 módulos, +2 assets PNG de marca).

Verificación en vivo (Claude in Chrome, local, ambos temas): comparación directa contra la imagen de referencia con recortes ampliados de íconos/badge/input/tarjeta de marca; tema claro confirmado sin el bug de contraste del sidebar; sin errores de consola.

Sin hallazgos de QA pendientes.
