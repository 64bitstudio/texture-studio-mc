# 073 — Quitar "Recientes", animaciones/transiciones, y rebranding

## Objetivo
Tres pedidos puntuales de Marco tras revisar el Editor rediseñado (ticket 072) en vivo: retirar la vista "Recientes" de la navegación, agregar animaciones/transiciones sutiles a toda la app, y actualizar el branding (quitar la imagen de fondo del sidebar, reemplazar el logo, usarlo también como favicon).

## Criterios de aceptación (TDD)
- Dado el sidebar de navegación, cuando se mira sus items, entonces solo aparecen "Nuevo proyecto"/"Mis proyectos" ("Recientes" ya no existe como destino ni como componente en el repo).
- Dado cualquier botón/`<select>` de la app, cuando se pasa el mouse por encima, entonces responde con una transición suave (no un cambio instantáneo).
- Dado que se navega entre pantallas (Nuevo proyecto/Mis proyectos/Proyecto/Configuración/Editor), cuando la pantalla nueva aparece, entonces lo hace con un fundido de entrada.
- Dado el modal "Agregar mob" (ticket 071)/la vista previa ampliada de un mob, cuando se abren, entonces aparecen con una animación de entrada (fundido + escala), no de golpe.
- Dado una miniatura 3D ("render") que todavía se está generando, cuando se mira la tarjeta, entonces se ve un pulso de carga en vez de una imagen estática indistinguible del resultado final.
- Dado el sidebar de navegación, cuando se mira su fondo, entonces es un color sólido (sin la imagen de píxeles verdes de antes).
- Dado el logo de la app (topbar, tarjeta de marca del sidebar, favicon de la pestaña), cuando se mira, entonces es el ícono nuevo (bloque de pasto + lápiz) que mandó Marco.

## Hecho
**Recientes**: `Recientes.tsx` eliminado del repo, `NavView`/`View` sin `'recientes'`, `App.tsx` sin la rama de render correspondiente.

**Animaciones/transiciones** (confirmado con Marco vía `AskUserQuestion`: alcance = toda la app, estilo = sutil): extendida la transición base de `.ui-button` (`color`/`filter`/`transform`, con un `:active` de "presionado" al soltar), hover+transición para `.ui-select`/`.ui-menu__item`, `.ts-fade-in` (ya existía solo para el Editor, ticket 032) extendido a las otras 4 pantallas (`NuevoProyecto`/`MisProyectos`/`Proyecto`/`Settings`), nuevas `.ts-modal-backdrop`/`.ts-modal-panel` para los 2 modales reales de la app (`AgregarMobModal`, `MobPreviewModal`), y `.ts-render-thumb`/`.ts-render-loading` (pulso de carga + fundido al terminar) para las miniaturas 3D en `MobEntryCard.tsx`/`ProjectCard.tsx`/`MobPreviewModal`.

Hallazgo real: varios botones (nav del sidebar principal, sidebar del editor) tenían sus colores puestos como estilo inline condicional (`background`/`border`/`color` según estado activo) -- eso IMPIDE que un hover de CSS funcione (un valor inline siempre gana sobre una regla de hoja de estilos, incluida `:hover`). Se movieron a clases CSS (`.ts-nav-item`/`.ts-nav-item--active`, `.ts-sidebar-project-card`, `.ts-sidebar-mob-item`/`--active`, `.ts-sidebar-add-mob`) sin cambiar ningún color de reposo/activo existente -- corrige hovers que en realidad nunca habían funcionado, no solo "sin animación".

**Branding**: `assets/brand/sidebar-bg.png` eliminado del repo (fondo del `<nav>` del sidebar ahora un color sólido fijo `#0f171d`, sin imagen). `assets/brand/logo.png` reemplazado por el logo nuevo de Marco (bloque de pasto + lápiz), reescalado de 1254×1254 a 256×256 con `sips` (mismo orden de magnitud que el logo anterior, evita inflar el bundle para un ícono que se usa a 28-34px). Favicon nuevo: `public/favicon.png` (64×64, mismo logo) reemplaza al `favicon.svg` genérico anterior, referenciado desde `index.html`.

Verificado en vivo con Claude in Chrome (oscuro/claro): hover del sidebar principal y del sidebar del editor, apertura de ambos modales, navegación entre las 5 pantallas (fundido visible en cada una), logo en topbar/tarjeta de marca del sidebar/favicon de la pestaña del navegador. `tsc`/`oxlint`/`vitest` (215)/`build` en verde.

Nota: este ticket y el 071/072 se implementaron en la misma sesión de iteración en vivo con Marco, con cambios entrelazados en varios archivos compartidos (`index.css`, `Sidebar.tsx`, `App.tsx`, `EditorProjectSidebar.tsx`) entre los 3 tickets -- separarlos en PRs limpios habría significado rehacer los cambios 2-3 veces en ramas distintas. Marco confirmó explícitamente (`AskUserQuestion`) empaquetar los 3 en un único PR bajo el mismo VoBo.
