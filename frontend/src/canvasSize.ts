// Tamaño de presentacion del `<canvas>` de textura (ticket 010).
// Modulo puro -- mismo criterio de testabilidad que
// `zoom.ts`/`resolution.ts`/`symmetry.ts`.
//
// Contexto (ver `docs/ARQUITECTURA.md`, ticket 005/008): antes de este
// ticket, `TextureEditor` fijaba `style.width`/`style.height` en
// `buffer.width*zoom`/`buffer.height*zoom` pero agregaba ademas
// `maxWidth: '100%'` -- cuando el ancho disponible del `<aside>` (fijo
// en 280px) era menor a ese ancho logico, el navegador comprimia SOLO
// el ancho renderizado (`maxWidth` recorta, no reescala
// proporcionalmente) sin tocar el alto, produciendo texeles NO
// cuadrados (`scaleX != scaleY`).
//
// Fix de este ticket: el tamaño de presentacion del canvas SIEMPRE se
// deriva del mismo factor de escala (`zoom`) en ambos ejes -- nunca de
// un porcentaje del contenedor. El ancho disponible del panel (medido
// por `ResizeObserver` en `Editor.tsx`, mismo patron que
// `PasteImageOverlay.tsx`) NUNCA participa en este calculo -- solo se
// usa para decidir si el contenedor debe scrollear
// (`canvasOverflowsAvailableWidth`), nunca para encoger el canvas.

export interface CanvasDisplaySize {
  width: number;
  height: number;
}

/**
 * Tamaño de presentacion (pixeles CSS) del canvas de textura: el mismo
 * factor de escala (`zoom`) aplicado a ambas dimensiones nativas
 * (`nativeWidth`/`nativeHeight` -- `buffer.width`/`buffer.height`, ya
 * escalado por la resolucion de trabajo x1-x10 del ticket 009). Por
 * construccion, `width / nativeWidth === height / nativeHeight ===
 * zoom` siempre -- un texel nunca puede rendirse no cuadrado con este
 * calculo, sin importar el ancho disponible del panel.
 */
export function computeCanvasDisplaySize(nativeWidth: number, nativeHeight: number, zoom: number): CanvasDisplaySize {
  return { width: nativeWidth * zoom, height: nativeHeight * zoom };
}

/**
 * Verdadero si el ancho de presentacion del canvas excede el ancho
 * disponible medido del contenedor -- en ese caso, el contenedor debe
 * scrollear horizontalmente (`overflow-x: auto`) en vez de que el
 * canvas se comprima. `availableWidth === null` significa "todavia no
 * se midio" (primer render, antes de que el `ResizeObserver` reporte)
 * -- se asume que cabe hasta tener una medicion real, para no mostrar
 * un scroll fantasma antes de tiempo.
 */
export function canvasOverflowsAvailableWidth(canvasWidth: number, availableWidth: number | null): boolean {
  if (availableWidth === null) return false;
  return canvasWidth > availableWidth;
}
