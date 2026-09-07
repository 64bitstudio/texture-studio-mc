# 078 — Herramienta "Seleccionar" + Copiar/Cortar/Pegar, y renombre de "Mano" a "Mover"

## Objetivo
Marco pidió dos cosas sobre la barra de herramientas del editor de textura: (1) el botón de mover el lienzo decía "Mano" y debía decir "Mover"; (2) quería una herramienta de selección rectangular que permitiera copiar/cortar esa selección y volver a pegarla. Ronda de preguntas resuelta con Marco (`AskUserQuestion`): selección rectangular (no libre), portapapeles interno de la app (no el del sistema operativo -- reutiliza el mismo overlay ✓/✗ redimensionable ya construido para "pegar imagen"), y "Cortar" deja los píxeles originales transparentes (igual que el Borrador, no rellenos del color activo).

## Criterios de aceptación (TDD)
- Dado el botón de mover el lienzo en la barra de herramientas, cuando se mira, entonces dice "Mover" (no "Mano").
- Dada la barra de herramientas, cuando se activa "Seleccionar" y se arrastra sobre el lienzo, entonces se dibuja un rectángulo de selección -- un click sin arrastre produce una selección de 1×1.
- Dada una selección activa, cuando se mira, entonces aparecen botones flotantes para Copiar, Cortar y Cancelar, además de una esquina para redimensionarla o poder arrastrarla para moverla.
- Dado que se presiona "Copiar" con una selección activa, entonces los píxeles de esa región quedan en el portapapeles interno de la app (sin modificar el buffer) y la selección se limpia.
- Dado que se presiona "Cortar", entonces los píxeles se copian al portapapeles Y quedan transparentes en el buffer original, como UNA sola unidad de deshacer (Ctrl/Cmd+Z restaura los píxeles originales en un solo paso).
- Dado contenido en el portapapeles interno, cuando se presiona "Pegar" (nuevo botón junto a "Importar", deshabilitado sin nada copiado/cortado), entonces aparece el mismo overlay ✓/✗ redimensionable que ya usa "pegar imagen" externa, con la vista previa del contenido copiado.
- Dado Ctrl/Cmd+V (pegado del portapapeles del SISTEMA OPERATIVO), cuando se usa, entonces sigue funcionando exactamente igual que antes -- el botón "Pegar" es una vía adicional para el portapapeles INTERNO, no reemplaza ni se mezcla con esa otra vía.
- Dado que se cambia de mob, entonces el portapapeles interno se pierde (alcance confirmado con Marco: no persiste entre mobs, solo dentro del mismo mob que se está editando).

## Hecho
**Renombre**: `Editor.tsx`, el botón de `paintMode === 'pan'` cambió su texto/tooltip de "Mano" a "Mover" -- nombres internos (`handlePanPointerDown`, comentarios, `paintMode === 'pan'`) sin cambios, por no ser user-facing.

**Herramienta Seleccionar**: `paintMode` extendido a `'paint' | 'erase' | 'pan' | 'select'`. Nuevo componente `SelectionOverlay.tsx` (mismo patrón de UI que `PasteImageOverlay.tsx`) que maneja dos fases en un mismo componente: dibujar el rectángulo inicial (arrastre libre sobre un lienzo transparente) y ajustarlo después (mover/redimensionar + botones Copiar/Cortar/Cancelar). Se oculta mientras hay un `pendingPaste` activo, para no competir por el puntero con ese overlay.

**Extracción de píxeles**: `extractPixelSource(source, clamped)` nueva en `importImage.ts` -- operación inversa de `computeBurnPixels`, recorta 1:1 (sin resampling) una región de un `PixelSource` cualquiera. Con tests unitarios dedicados.

**Portapapeles interno**: estado `internalClipboard` en `Editor.tsx` (solo `{ source: PixelSource }`, vive y se pierde con el `Editor` -- confirmado con Marco, no sobrevive el cambio de mob). "Cortar" limpia los píxeles originales reusando el mecanismo de historial existente (`beginStroke`/`recordChange`/`commitStroke`), igual que cualquier otra escritura del editor.

**Pegar desde el portapapeles**: nueva función `encodePixelSourceToPreviewUrl(source)` en `decodeTexture.ts` (codifica un `PixelSource` en memoria a un blob PNG + object URL, mismo contrato de ciclo de vida que la decodificación de archivos externos) -- el botón "Pegar" reutiliza tal cual el mismo `pendingPaste`/`PasteImageOverlay`/`handleConfirmPaste`/`handleCancelPaste` que ya existían para pegar una imagen externa, sin construir una segunda UI de confirmación.

**Iconos nuevos** (`ui/icons.tsx`): `IconSelect`, `IconCopy`, `IconScissors`, `IconClipboardPaste`.

Hallazgo real del hook `ui-accessibility-guard.sh` (documentado en la memoria del equipo): un `<button>` icon-only con `aria-label` correcto en la apertura igual se marca como "sin etiqueta" si el tag queda partido en varias líneas -- el extractor del hook divide el match línea por línea antes de buscar el atributo. Se resolvió escribiendo cada botón flotante (apertura + ícono + cierre) en una sola línea, mismo patrón ya usado por `PasteImageOverlay.tsx`.

Verificado en vivo con Claude in Chrome (oscuro/claro), contra un proyecto real del Esqueleto: dibujar selección por arrastre real (no simulado), redimensionar, Copiar → Pegar (el overlay de pegado aparece con la vista previa correcta), Cortar (píxeles quedan transparentes) y Ctrl/Cmd+Z (restaura en un solo paso). `tsc`/`oxlint`/`vitest` (227, +7 tests nuevos de `extractPixelSource`)/`build` en verde.
