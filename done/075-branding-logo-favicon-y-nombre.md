# 075 — Branding: logo/favicon nuevos, logo de topbar más grande, y nombre "Texture Studio"

## Objetivo
Marco mandó una serie de imágenes nuevas para el logo/favicon (reemplazando el del ticket 073) hasta quedar conforme, pidió agrandar el logo de la topbar, y el nombre de la app pasó de "Texture Studio MC" a "Texture Studio" en todos los lugares donde aparece (pestaña del navegador, `pack.mcmeta` exportado).

## Criterios de aceptación (TDD)
- Dado el logo/favicon, cuando se mira en la topbar/pestaña del navegador, entonces es la última imagen que mandó Marco, con fondo realmente transparente (sin halo blanco al componer sobre el tema oscuro).
- Dado el logo de la topbar, cuando se compara con el tamaño anterior, entonces se ve más grande (34px -> 44px).
- Dado el nombre de la app, cuando aparece en la pestaña del navegador o en un pack exportado, entonces dice "Texture Studio" (sin "MC").

## Hecho
**Logo/favicon**: `assets/brand/logo.png`/`public/favicon.png` reemplazados tres veces en esta ronda con las imágenes que fue mandando Marco, hasta la versión final con alfa real. La segunda imagen recibida no traía canal alfa real (fondo "blanco" horneado y con ruido de bajo contraste, no un color plano) -- un primer intento de quitar el fondo por flood-fill desde las esquinas dejó un halo visible (bug real reportado por Marco: "se ve blanco el fondo"). Se corrigió con un umbral global por (spread de color + brillo) en vez de flood-fill por conectividad -- ver memoria del equipo `chatgpt-image-fake-transparency` para el detalle técnico reusable. La tercera imagen ya traía alfa real y se usó directo.

**Tamaño del logo en topbar**: `AppShell.tsx`, `width`/`height` de `34` a `44`.

**Nombre "Texture Studio"**: `index.html` (`<title>`), `exportPack.ts` (`DEFAULT_PACK_DESCRIPTION`, queda dentro del `pack.mcmeta` que se descarga al exportar un resource pack).

Verificado en vivo con Claude in Chrome (oscuro/claro): logo en topbar sin halo compuesto sobre el fondo real de la app, favicon de la pestaña, tamaño más grande visible. `tsc`/`oxlint`/`vitest` (215)/`build` en verde.

Nota: la verificación final de transparencia NO se hizo confiando en la vista previa del visor `Read` (mostró un checkerboard incluso sobre un archivo ya confirmado opaco por `PIL.Image.getpixel` -- falsa alarma del propio visor), sino componiendo manualmente contra el color real de fondo de la app y contra el render real del navegador.
