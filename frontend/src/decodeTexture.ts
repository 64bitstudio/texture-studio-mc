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
//
// EXTENSION ticket 019 (guardado de proyectos): `width`/`height` ahora
// son OPCIONALES -- si se omiten, decodifica a la resolucion NATURAL del
// PNG (`img.naturalWidth/Height`), sin forzar ningun `drawImage`
// escalado. Necesario para `projectSnapshot.ts` (`restoreProjectBuffers`):
// un PNG guardado por un proyecto YA mide exactamente
// `nativeWidth*resolucion x nativeHeight*resolucion` (es el mismo
// buffer codificado tal cual, ver `export.ts`), asi que no hace falta
// conocer de antemano las dimensiones nativas del mob (que requeriria
// volver a pedirle al backend la geometria de CADA mob del proyecto,
// no solo la del mob activo) para decodificarlo correctamente -- el
// propio archivo ya las contiene. El caso existente (llamado con
// `width`/`height` explicitos desde `Editor.tsx` para la textura base)
// sigue exactamente igual, sin cambio de comportamiento.
export function decodePngDataUrlToImageData(dataUrl: string, width?: number, height?: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const targetWidth = width ?? img.naturalWidth;
      const targetHeight = height ?? img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo obtener el contexto 2D del canvas de decodificacion.'));
        return;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      try {
        resolve(ctx.getImageData(0, 0, targetWidth, targetHeight));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('No se pudo leer los pixeles de la textura.'));
      }
    };
    img.onerror = () => reject(new Error('No se pudo decodificar la textura.'));
    img.src = dataUrl;
  });
}

/**
 * Decodifica un `File`/`Blob` arbitrario (import de PNG del ticket 005,
 * HU-8, o imagen pegada/subida de HU-9) a `ImageData`, a diferencia de
 * `decodePngDataUrlToImageData` -- que fuerza el `drawImage` a un
 * tamaño fijo (64x32, siempre correcto para la textura base ya
 * validada) -- esta funcion dibuja a la resolucion NATURAL de la
 * imagen (`img.naturalWidth/Height`), sin forzar ningun tamaño. Es
 * deliberado: HU-8 necesita conocer las dimensiones reales para
 * rechazar un PNG que no mida exactamente 64x32 (`validateImportDimensions`
 * en `importImage.ts`) -- si se forzara aca el tamaño a 64x32, la
 * validacion de dimensiones se volveria imposible (cualquier imagen se
 * "encajaria" silenciosamente, estirada, perdiendo la señal de error).
 *
 * Contrato de `previewUrl`: esta funcion CREA el `object URL` (para
 * poder cargarlo en un `Image`) pero NO lo revoca en el camino exitoso
 * -- lo devuelve para que el llamador decida su ciclo de vida (HU-9 lo
 * mantiene vivo mientras el overlay de "pegar imagen" esta en pantalla,
 * como `src` del `<img>` de vista previa, y lo revoca recien al
 * confirmar/cancelar -- ver `components/Editor.tsx`; HU-8 no necesita
 * vista previa, y lo revoca inmediatamente tras decodificar). En los
 * caminos de error SI se revoca aca mismo, porque nunca llega a
 * entregarse a un llamador que pueda hacerse cargo.
 */
export function decodeImageFileToImageData(source: File | Blob): Promise<{ imageData: ImageData; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const previewUrl = URL.createObjectURL(source);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(previewUrl);
        reject(new Error('No se pudo obtener el contexto 2D del canvas de decodificacion.'));
        return;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      try {
        resolve({ imageData: ctx.getImageData(0, 0, width, height), previewUrl });
      } catch (err) {
        URL.revokeObjectURL(previewUrl);
        reject(err instanceof Error ? err : new Error('No se pudieron leer los pixeles de la imagen.'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error('No se pudo decodificar el archivo como imagen.'));
    };
    img.src = previewUrl;
  });
}
