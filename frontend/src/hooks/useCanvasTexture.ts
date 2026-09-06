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
 *
 * Ticket 009 (resolucion de trabajo escalable x1-x10): `buffer` puede
 * ser REEMPLAZADO por una instancia de otro tamaño cuando cambia la
 * resolucion (ver `components/Editor.tsx`, `resolution.ts`) -- el
 * canvas offscreen ya no puede crearse una unica vez con las
 * dimensiones del `buffer` de montaje inicial (`useState` perezoso, tal
 * como hacia este hook antes de este ticket): si el tamaño cambiara sin
 * redimensionar tambien el `<canvas>`, `ctx.putImageData` fallaria (el
 * `ImageData` fuente ya no cabe en un canvas mas chico) o quedaria
 * recortado en silencio. El efecto de abajo redimensiona el `<canvas>`
 * cada vez que `buffer.width`/`buffer.height` no coinciden con el
 * tamaño actual, antes de volcar los pixeles.
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
    if (canvas.width !== buffer.width || canvas.height !== buffer.height) {
      // Mutar el `<canvas>` (un elemento DOM real, no un valor
      // inmutable de React) devuelto por `useState` es el patron
      // idiomatico para un canvas offscreen creado una sola vez -- mismo
      // criterio ya aplicado abajo para `texture.needsUpdate`.
      // oxlint-disable-next-line react/immutability
      canvas.width = buffer.width;
      // oxlint-disable-next-line react/immutability
      canvas.height = buffer.height;
    }
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
