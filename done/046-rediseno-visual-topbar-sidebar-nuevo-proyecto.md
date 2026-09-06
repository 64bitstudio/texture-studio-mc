# 046 — Rediseño visual: topbar, sidebar y "Nuevo proyecto"

## Objetivo
Marco pidió (mensaje directo, con imagen de referencia) que la topbar, el sidebar y la pantalla "Nuevo proyecto" se vean "exactamente iguales" a un mockup nuevo (paleta más oscura, íconos de línea fina, tarjetas redondeadas con miniaturas reales de mob, insignias/badges). Alcance explícitamente **solo visual** -- sin cambios de comportamiento/arquitectura salvo las excepciones mínimas descritas abajo.

## Alcance
- Tokens de tema oscuro (`index.css`): fondo/paneles más oscuros, radios más grandes para tarjetas, para acercarse a la paleta del mockup. El acento verde se ajusta de tono si hace falta tras comparar en vivo contra la imagen (sigue siendo un solo valor compartido entre ambos temas, mismo criterio del ticket 035).
- Set de íconos nuevo, dibujado a mano en SVG inline (`ui/icons.tsx`) -- decisión de Marco tras pregunta explícita: sin librería de íconos nueva. Reemplaza los emoji actuales (➕📁🕐☀️🌙⚙️) en las 3 áreas de este ticket.
- Miniaturas reales de mob en "Selecciona un mob": Marco pidió buscar las miniaturas oficiales en internet -- se descargan los renders oficiales de cada mob (Minecraft Wiki, mismo estilo/ángulo que usa la propia wiki en el infobox de cada entidad) como assets estáticos del frontend (`assets/mob-icons/`), no se generan en vivo.
- `Sidebar.tsx`: bloque de marca superior (ícono + título + subtítulo), items de navegación con ícono en caja + estado activo (fondo/borde acento), tarjeta de marca al pie (ícono + título + tagline), fondo decorativo sutil en la esquina inferior.
- `AppShell.tsx`/topbar: los 3 controles de la derecha pasan a botones cuadrados con ícono (tema, ⚙️ Configuración como control PROPIO y separado del avatar, avatar). Ver "Qué NO hacer" sobre el reasignado de click del avatar.
- `NuevoProyecto.tsx`: cabecera con ícono, tarjetas de mob más grandes con miniatura real + badge de check al seleccionar, panel de vista previa con encabezado con ícono + badge "Minecraft Java Edition", tarjeta informativa del mob elegido (ícono + nombre + descripción corta -- copy nueva, ver abajo), callout con ícono para la nota de "vista previa aproximada".

## Qué NO hacer
- No tocar `AgregarMobs.tsx`/`MobSelector.tsx`/`Mis proyectos`/`Recientes`/`Proyecto`/`Editor`/`Settings` en este ticket -- comparten patrones visuales (tarjetas de mob, botones) con las 3 áreas de este ticket y van a verse visualmente inconsistentes hasta un ticket de seguimiento que extienda el mismo sistema. Señalado explícitamente a Marco al cerrar.
- No agregar ninguna dependencia nueva de íconos (decisión explícita).
- No generar miniaturas de mob en vivo (4 escenas WebGL simultáneas) ni construir un pipeline de renderizado -- se usan imágenes estáticas descargadas una vez.

## Decisiones tomadas sobre la marcha (documentar en ARQUITECTURA.md)
- El avatar deja de abrir Configuración por su cuenta (antes estaba envuelto en un `<button onClick={onOpenSettings}>`) -- el mockup separa claramente "⚙️ Configuración" (control propio) del avatar (identidad/decorativo). Configuración sigue 100% alcanzable, ahora por su propio botón correctamente etiquetado -- no se pierde funcionalidad.
- Botones ícono-only (tema/Configuración) mantienen su nombre accesible (texto) pero visualmente oculto (`sr-only`) en vez de visible -- conserva la intención de accesibilidad del ticket 032 ("nunca un botón sin nombre accesible") sin el texto visible que el mockup no muestra.
- El input de "Nombre del proyecto" gana un botón "limpiar" (ícono ✕) -- pequeña adición de interacción (no 100% "solo visual" en sentido estricto), de bajo riesgo y esperable en cualquier campo con ese ícono. Señalado explícitamente, no es un parche silencioso.
- Copy nueva (sin tocar ningún endpoint/dato del backend): descripción corta de cada mob (ej. "Explota al acercarse al jugador." para Creeper) y el subtítulo "Elige el mob que quieres editar." -- contenido estático del frontend, mismo criterio que `DEFAULT_PACK_DESCRIPTION`.

## Verificación
- En vivo (Claude in Chrome, ambos temas si aplica): comparación visual directa contra la imagen de referencia -- paleta, tipografía, espaciado, íconos, tarjetas de mob con miniatura real, estados activo/hover.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que abro la app, cuando veo la topbar/sidebar/"Nuevo proyecto", entonces la paleta, los íconos y el layout coinciden con la imagen de referencia.
- Dado que hago click en "Configuración", entonces se abre la pantalla de Configuración (sin importar que ya no dependa del avatar).
- Dado que selecciono un mob en "Nuevo proyecto", entonces la tarjeta muestra su miniatura oficial real y un badge de check.

## Hecho

Implementado tal como estaba alcanzado, con las dos decisiones ya confirmadas por Marco (íconos SVG a mano, miniaturas oficiales de internet) y las excepciones ya señaladas arriba:

- **`ui/icons.tsx`** (nuevo): 11 íconos de línea fina hand-rolled + `IconGrassBlockLogo` (relleno, imita el bloque de pasto).
- **`assets/mob-icons/{creeper,skeleton,zombie,spider}.png`** (nuevo): renders oficiales descargados de Minecraft Wiki (`Creeper_JE3_BE1.png`/`Skeleton_JE6_BE4.png`/`Zombie_JE5_BE2.png`/`Spider_JE5_BE4.png`), verificados visualmente uno por uno antes de usarlos (fondo transparente, mismo ángulo/estilo consistente entre los 4).
- **`mobIcons.ts`** (nuevo): `MOB_ICONS`/`MOB_DESCRIPTIONS`, contenido presentacional del frontend.
- **`index.css`**: tema oscuro considerablemente más oscuro, `--accent` afinado de `#4ade80` a `#34d399`, nuevos `--accent-soft`/`--accent-soft-strong`/`--radius-lg`, clases `.ui-button--icon-square`/`.sr-only`.
- **`Sidebar.tsx`/`AppShell.tsx`/`ThemeToggle.tsx`/`Avatar.tsx`**: rediseño completo según lo alcanzado; "Configuración" pasa a botón propio, avatar vuelve a ser decorativo (ver "Decisiones tomadas sobre la marcha").
- **`NuevoProyecto.tsx`**: rediseño completo según lo alcanzado -- TODA la lógica de estado/handlers quedó exactamente igual, solo cambió el JSX/estilos.

Tests: 197/197 en verde (sin tests nuevos -- cambio 100% visual/presentacional). `npm run lint` y `npm run build` en verde (636 módulos, +4 assets PNG).

Verificación en vivo (Claude in Chrome, local, tema oscuro comparado contra la imagen de referencia + tema claro + pantallas fuera de alcance): ver `docs/ARQUITECTURA.md`, "Ticket 046" para el detalle completo. Un ajuste real encontrado en vivo: el sidebar se ensanchó de 240px a 272px porque "Texture Studio MC" se partía en dos líneas a 240px.

Sin hallazgos de QA pendientes.
