# 034 — Sistema de tema claro/oscuro

## Objetivo
Sale de `docs/definiciones/proyectos-y-navegacion.md` (HU-5, "Diseño técnico" — tema claro/oscuro). Primer ticket de la base visual que necesita el resto del epic (navegación, configuración) antes de construir sobre ella.

## Alcance
- Los tokens de color de `frontend/src/index.css` (ticket 025: `--bg`, `--panel-bg`, `--text`, `--text-dim`, `--accent`, `--border`, `--border-strong`, `--surface-raised`, etc.) se separan en dos bloques: `:root[data-theme="dark"]` (default, valores actuales) y `:root[data-theme="light"]` (paleta nueva, mismo contraste mínimo que el tema oscuro).
- Preferencia guardada en `localStorage` (clave `ts-theme`, valores `'light' | 'dark'`), aplicada como atributo `data-theme` en `<html>` ANTES del primer render (sin parpadeo del tema equivocado al cargar).
- Toggle visible en el header (ícono sol/luna) que cambia el tema al instante.
- Sin selector de "automático/según el sistema" en este ticket — solo claro/oscuro explícitos, con oscuro como default si nunca se configuró.

## Qué NO hacer
- No construir la pantalla de "Configuración" todavía (ticket 036) — este ticket solo deja la MECÁNICA del tema (tokens + persistencia + toggle mínimo), reusable desde cualquier UI que se construya después.
- No tocar el acento morado/verde en este ticket (ticket 035, aparte).

## Verificación
- En vivo (Claude in Chrome): cambiar el toggle y confirmar que TODA la UI visible cambia de paleta sin recargar; recargar la página y confirmar que el tema elegido persiste; confirmar que no hay parpadeo del tema por defecto antes de aplicar el guardado.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado que nunca configuré un tema, cuando abro la app, entonces veo el tema oscuro (default).
- Dado que activo el toggle, cuando cambio a claro, entonces toda la UI (fondo, texto, bordes, componentes `ui/`) usa la paleta clara de inmediato.
- Dado que elegí un tema, cuando recargo la página, entonces se mantiene el mismo tema (sin parpadeo del contrario antes de aplicarlo).

## Hecho

Implementado tal como estaba alcanzado:

- `theme.ts` (nuevo): `getTheme`/`setTheme`/`toggleTheme`/`nextTheme`, persistencia en `localStorage` vía `globalThis.localStorage` (mismo criterio del ticket 019, testeable sin jsdom).
- `index.css`: tokens de color movidos a `:root[data-theme='dark']`/`:root[data-theme='light']`; nuevos tokens `--hover-overlay`/`--overlay-bg` para dos casos que antes usaban un color blanco/oscuro fijo (invisibles o fuera de lugar en el tema contrario).
- `index.html`: script inline que aplica el tema guardado antes del primer render de React (sin parpadeo).
- `components/ThemeToggle.tsx` (nuevo): botón ícono+texto, montado en el header actual de `App.tsx` (ambas vistas) -- ubicación temporal, el ticket 037 lo reubica en el header definitivo sin tocar su lógica.
- Se actualizaron 3 literales `rgba(255,255,255,...)` hardcodeados en `App.tsx`/`TextureEditor.tsx`/`ColorPicker.tsx` (bordes que asumían fondo oscuro) para usar `var(--border)`/`var(--border-strong)` -- sin este cambio se hubieran visto invisibles/mal en tema claro.

Dos bugs reales encontrados y corregidos en vivo (ninguno hipotético, ambos confirmados con captura/reproducción antes del fix):
1. `color-scheme: light dark` estático en `:root` hacía que los `<select>`/`<input>` sin estilo propio (`HomeScreen.tsx`) siguieran el tema del SISTEMA OPERATIVO en vez del tema de la app -- con tema claro activo y SO en oscuro, esos controles se veían oscuros. Corregido fijando `color-scheme` dentro de cada bloque `[data-theme]`.
2. `npm run build` falló con `parse5: eof-in-comment` -- el comentario HTML nuevo en `index.html` se cerró por error con `*/` (sintaxis de JS) en vez de `-->` (HTML). Corregido antes de continuar; hubiera roto el build de producción si no se hubiera detectado.

Tests: 174/174 en verde (incluye `theme.spec.ts` nuevo, 5 tests sobre `getTheme`/`nextTheme` -- `setTheme`/`toggleTheme`, que tocan el DOM, se verificaron en vivo en vez de con test unitario), `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local): toggle cambia toda la UI visible al instante en ambas vistas (Home/Editor); recargar la página mantiene el tema elegido; el menú "Proyecto" desplegable, los checkboxes y los `Section` se ven correctos en ambos temas (capturas de pantalla); el bug de `color-scheme` se reprodujo primero y se re-verificó corregido después.

Sin hallazgos de QA pendientes.
