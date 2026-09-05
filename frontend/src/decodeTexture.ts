// Decodifica el `data:image/png;base64,...` que devuelve
// `GET /api/base-assets/skeleton` a un `ImageData` de 64x32, para
// inicializar el `TextureBuffer` (ver `components/Editor.tsx`).
//
// Depende de APIs exclusivas del navegador (`Image`, `<canvas>`) --
// deliberadamente separado de `textureBuffer.ts` (que es puro y
// testeable sin DOM) para no forzar a esa clase a asumir un entorno de
// navegador. No tiene tests unitarios dedicados: mockear `Image`/canvas
// para probar esto es mas ruido que valor dado su tamaño; se valida en
// la revision visual en vivo (ver checklist de cierre del ticket).

export function decodePngDataUrlToImageData(dataUrl: string, width: number, height: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo obtener el contexto 2D del canvas de decodificacion.'));
        return;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(ctx.getImageData(0, 0, width, height));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('No se pudo leer los pixeles de la textura base.'));
      }
    };
    img.onerror = () => reject(new Error('No se pudo decodificar la textura base del Esqueleto.'));
    img.src = dataUrl;
  });
}
