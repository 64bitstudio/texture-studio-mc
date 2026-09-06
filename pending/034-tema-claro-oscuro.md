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
