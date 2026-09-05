import { useEffect, useState } from 'react';
import * as THREE from 'three';
import type { TextureBuffer } from '../textureBuffer';

/**
 * Crea (una sola vez, via inicializador perezoso de `useState` -- no
 * lee/escribe refs durante el render) una `THREE.CanvasTexture`
 * respaldada por un `<canvas>` fuera del DOM, y la mantiene
 * sincronizada con `buffer` cada vez que `version` cambia -- sync en
 * vivo con el visor 3D (HU-3, ticket 002): `texture.needsUpdate = true`
 * sin refetch del asset base ni recarga de pagina.
 *
 * Por que `CanvasTexture` y no `THREE.DataTexture` sobre el mismo
 * `Uint8ClampedArray`: el ticket 001 ya valido visualmente el mapeo UV
 * (`applyBoxUV.ts`) asumiendo el `flipY = true` por default de
 * `THREE.Texture`/`CanvasTexture` (mismo comportamiento que el
 * `useLoader(TextureLoader, dataUrl)` que reemplaza este hook).
 * `DataTexture` por default trae `flipY = false`, lo que invertiria
 * verticalmente el modelo ya calibrado -- ver docs/ARQUITECTURA.md.
 */
export function useCanvasTexture(buffer: TextureBuffer, version: number): THREE.CanvasTexture {
  const [canvas] = useState(() => {
    const c = document.createElement('canvas');
    c.width = buffer.width;
    c.height = buffer.height;
    return c;
  });

  const [texture] = useState(() => {
    const t = new THREE.CanvasTexture(canvas);
    // Pixel-art nitido, sin blur ni mipmaps -- mismo criterio que
    // ticket 001 (ver Viewer3D.tsx / docs/COMPONENTES.md).
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    return t;
  });

  useEffect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(buffer.toImageData(), 0, 0);
    // Mismo caso que Viewer3D.tsx (ticket 001): mutar sampler
    // settings/needsUpdate sobre una THREE.Texture ya creada es el
    // patron idiomatico de three.js, no un descuido de inmutabilidad.
    // oxlint-disable-next-line react/immutability
    texture.needsUpdate = true;
  }, [buffer, version, canvas, texture]);

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return texture;
}
