# 074 — Editor: rango de zoom, preview 3D, toolbar de importar/pegar, herramienta Mano, y scroll interno del lienzo

## Objetivo
Ronda de correcciones de Marco tras revisar el Editor rediseñado (ticket 072) en vivo, sobre su proyecto real "Galgoth" (Zombie a escala x6/384×384): el zoom no bajaba de 400%, la vista previa 3D se veía muy chica, "Importar"/"Pegar" no estaban junto a Pincel/Borrador, la confirmación de un pegado no tenía botones claros de aceptar/cancelar, no había forma de mover el scroll del lienzo sin bajar hasta la barra del navegador, y a resoluciones/zoom altos el lienzo se salía de su panel y arrastraba a toda la app en un scroll de página.

## Criterios de aceptación (TDD)
- Dado el control de Zoom del editor, cuando se abre, entonces ofrece presets de 50% a 4000% (antes el mínimo eran 400%) como un `<select>`, no un stepper +/-.
- Dado el panel "Vista previa 3D", cuando se abre el editor, entonces el modelo aparece más acercado que antes (no un punto lejano en el centro del visor).
- Dada la barra de herramientas del editor, cuando se mira, entonces "Importar" vive junto a Pincel/Borrador/Mano como un botón directo (sin menú desplegable intermedio), y usa el ícono de imagen.
- Dado que se pega una imagen (Ctrl/Cmd+V) sobre el lienzo, cuando aparece el recuadro de redimensionar, entonces trae un botón de palomita (confirmar) y uno de cruz (cancelar) visibles sobre la propia imagen pegada.
- Dada la barra de herramientas, cuando se activa "Mano", entonces arrastrar sobre el lienzo mueve el scroll del panel (horizontal y vertical) en vez de pintar, sin necesidad de usar la barra de scroll del navegador.
- Dado un lienzo cuyo contenido (resolución × zoom) excede la altura disponible del panel, cuando se scrollea sobre él, entonces solo el panel de textura se desplaza -- el resto de la pantalla (topbar, breadcrumb, título, toolbar, columna derecha) se queda fijo, y la página completa nunca entra en scroll.

## Hecho
**Zoom**: `ZOOM_MIN` bajado de `4` a `0.5` en `zoom.ts`; `ZoomControls.tsx` reescrito de un stepper +/- a un `<Select>` con presets fijos `ZOOM_PRESETS = [0.5, 1, 2, 3, 4, 6, 8, 10, 20, 30, 40]` (50% a 4000%).

**Vista previa 3D**: nuevo prop opcional `cameraZoom` en `Viewer3D.tsx` (default `1`, no afecta el uso ya existente en "Nuevo proyecto") que acerca la cámara hacia el objetivo con la misma fórmula que `renderMobSnapshot3D.ts`. Valor final afinado en vivo con Marco para el panel del Editor: `0.65`.

**Toolbar de importar/pegar**: se quitó el menú desplegable de "Importar" (dos entradas) y el botón separado de "Insertar imagen" -- ahora un solo botón "Importar" (ícono de imagen) dispara el input de archivo oculto; pegar (Ctrl/Cmd+V) sigue siendo el único disparador para pegar desde portapapeles. `PasteImageControls.tsx` (ya sin ningún botón que lo use) se eliminó del repo.

**Confirmar/cancelar pegado**: `PasteImageOverlay.tsx` gana botones ✓/✗ (`onConfirm`/`onCancel`) posicionados DENTRO del recuadro (`top: 4, right: 4`), no flotando arriba -- un intento inicial de ponerlos arriba del recuadro los dejaba recortados por el contenedor con scroll (ver hallazgo de CSS abajo).

**Herramienta Mano**: `paintMode` extendido a `'paint' | 'erase' | 'pan'`; overlay transparente (hermano, no hijo, del contenedor con scroll -- así se queda anclado al viewport visible en vez de desplazarse con el contenido) que intercepta el arrastre y mueve `scrollLeft`/`scrollTop` del contenedor directamente vía `setPointerCapture`.

**Scroll interno del lienzo**: el contenedor `textureSectionWrapperRef` gana `maxHeight: '70vh'` + `overflowY: 'auto'` explícito (antes solo tenía `overflowX: 'auto'`, sin límite de alto). Verificado en vivo contra el proyecto real de Marco a 400% de zoom / resolución x6 (el escenario exacto de su captura): el panel scrollea internamente, `window.scrollY` se mantiene en `0`.

Hallazgo real de CSS (aplica a los dos puntos de arriba: confirmar/cancelar pegado y scroll interno): fijar solo `overflow-x: auto` en un elemento hace que el navegador calcule `overflow-y` como `auto` también (spec de CSS Overflow) -- esto fue lo que originalmente recortaba los botones ✓/✗ al posicionarlos arriba del recuadro. Se corrigió declarando `overflow-y` explícito en vez de depender del cómputo implícito.

Verificado en vivo con Claude in Chrome (oscuro/claro) contra el proyecto real "Galgoth" → Zombie de Marco (x6, 384×384, 400%/1000% de zoom): los 6 criterios de aceptación confirmados uno por uno, incluido arrastrar con "Mano" activa (Deshacer se mantuvo deshabilitado, confirmando que no pintó nada) y el scroll interno del lienzo (inspección de `scrollTop`/`maxHeight` computado vía consola). `tsc`/`oxlint`/`vitest` (215)/`build` en verde.

Nota: igual que 071/072/073, este ticket comparte varios archivos con 075/076 (mismo `Editor.tsx`, `index.css`) -- van en el mismo PR bajo el mismo VoBo, ya con precedente explícito de Marco.
