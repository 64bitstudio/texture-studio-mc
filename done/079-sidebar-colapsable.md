# 079 — Sidebar colapsable a una franja de solo íconos

## Objetivo
Marco pidió que el sidebar pudiera "hacerse pequeño". Ronda de preguntas resuelta con Marco (`AskUserQuestion`): colapsa a una franja angosta de solo íconos (no se oculta por completo) -- la tarjeta "Proyecto actual"/lista de mobs del editor se oculta mientras está colapsado, sin una versión de solo-ícono para ese contenido. Ronda de correcciones en vivo tras la primera versión: el botón de colapsar generaba scroll horizontal y quedaba cortado, el icono quedaba muy amontonado contra el botón y entre sí, el radio de las esquinas era muy pronunciado, y el ancho colapsado final se ajustó a 76px.

## Criterios de aceptación (TDD)
- Dado el sidebar expandido, cuando se presiona el botón de colapsar (flecha en el borde derecho), entonces se angosta a una franja de solo íconos de navegación, sin scroll horizontal ni recorte del propio botón.
- Dado el sidebar colapsado, cuando se mira, entonces conserva el nombre accesible real de cada botón de navegación (oculto visualmente, no quitado del DOM) y un tooltip nativo (`title`) al pasar el mouse.
- Dado el sidebar del editor colapsado, cuando se mira, entonces la tarjeta "Proyecto actual"/lista de mobs no se muestra -- reaparece al expandir.
- Dado que se colapsa/expande el sidebar, cuando se recarga la página, entonces se abre en el mismo estado (persistido en `localStorage`, sin parpadeo del estado contrario).
- Dado el sidebar colapsado, cuando se mira, entonces hay separación clara entre el botón de colapsar y el primer ícono, y entre los íconos entre sí -- no se ven amontonados.

## Hecho
Nuevo módulo `frontend/src/sidebarCollapse.ts` (`getSidebarCollapsed`/`setSidebarCollapsed`, mismo patrón de `localStorage` que `theme.ts`) + estado levantado en `App.tsx` (mismo criterio que `theme`), pasado a través de `AppShell.tsx` hacia `Sidebar.tsx`.

`Sidebar.tsx`: ancho `272px` (expandido, sin cambios) / `76px` (colapsado). Colapsado: los 2 íconos de navegación quedan centrados sin su etiqueta visible (`.sr-only`, con `title` para el tooltip nativo), `extraContent` no se renderiza, y la tarjeta de marca del pie muestra solo el logo. Radio de esquina de los botones de navegación bajado de `--radius-lg` (14px) a `--radius-md` (8px), tanto expandido como colapsado.

Botón de colapsar/expandir: círculo flotante (mismo patrón visual que los botones circulares de `PasteImageOverlay.tsx`/`SelectionOverlay.tsx`) con un ícono nuevo `IconChevronLeft` (rotado 180° vía CSS para apuntar al lado contrario según el estado). Vive en un wrapper `<div>` NO scrolleable, como hermano del `<nav>` (que sí scrollea su contenido) -- hallazgo real de Marco ("el boton genera un scroll... se corta el boton"): tenerlo DENTRO del `<nav>` con `overflowY: 'auto'` hacía que el navegador computara también `overflow-x: auto` (spec de CSS Overflow: fijar un eje a un valor de scroll fuerza al otro eje "visible" a comportarse igual), atrapando el fragmento del botón que sobresalía del borde dentro de esa área de scroll recién generada.

Ajustes de espaciado tras revisión en vivo ("se ve muy amontonado"): padding-top del `<nav>` colapsado subido a 52px (despeja el botón flotante, que ya no queda encima del primer ícono) y `gap` entre íconos subido de 4px a 10px.

Hallazgo del hook `ui-accessibility-guard.sh` documentado en la memoria del equipo (nuevo, distinto al ya conocido): un match de icon-only `<button>` que queda partido en varias líneas se evalúa línea por línea buscando `aria-label` -- un botón de 3 líneas con el atributo correcto en la apertura igual generó 2 falsos positivos (uno por cada línea sin el atributo). Se resolvió escribiendo el tag completo (apertura + ícono + cierre) en una sola línea.

Verificado en vivo con Claude in Chrome (oscuro/claro): colapsar/expandir sin scroll ni recorte, `extraContent` oculto/visible correctamente dentro del editor, persistencia tras recargar la página, y espaciado/radio corregidos tras cada ronda de feedback. `tsc`/`oxlint`/`vitest` (227, +7 tests nuevos de `sidebarCollapse.ts`)/`build` en verde.
