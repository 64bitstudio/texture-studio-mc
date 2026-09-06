import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { TextureBuffer } from '../textureBuffer';

/**
 * Crea una `THREE.CanvasTexture` con los sampler settings fijos que usa
 * todo el proyecto (pixel-art nitido, ver Viewer3D.tsx / docs/COMPONENTES.md).
 *
 * Ticket 052 (hallazgo real, corrección de Marco -- comparó una captura
 * del visor contra la imagen de referencia lado a lado: "los colores no
 * son identicos ni para el fondo ni para el modelo"): `THREE.Texture`
 * (la clase base de `CanvasTexture`) trae `colorSpace = THREE.NoColorSpace`
 * por default -- el renderer NO decodifica sRGB→lineal al muestrear esta
 * textura en el shader, aunque el `<canvas>` 2D de donde sale (y el PNG
 * que eventualmente la llena, ver `ImageData`/`putImageData`) SÍ tiene
 * sus píxeles codificados en sRGB estándar (como cualquier imagen web).
 * Ese descalce (decodificación de entrada faltante + `WebGLRenderer`
 * codificando de todos modos a la salida, `SRGBColorSpace` por default
 * desde three.js r152) es la causa real de la apariencia "lavada"/de
 * bajo contraste reportada -- no el tone mapping (ya corregido en el
 * ticket 051, seguía sin alcanzar por esto). Fix: `colorSpace =
 * THREE.SRGBColorSpace` explícito, para que el pipeline haga el
 * redondeo completo (sRGB→lineal al entrar, lineal→sRGB al salir) en
 * vez de solo la mitad.
 */
function createCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Crea (una sola vez, via inicializador perezoso de `useState` -- no
 * lee/escribe refs durante el render) un `<canvas>` fuera del DOM, y
 * mantiene una `THREE.CanvasTexture` respaldada por el sincronizada con
 * `buffer` cada vez que `version` cambia -- sync en vivo con el visor 3D
 * (HU-3, ticket 002): sin refetch del asset base ni recarga de pagina.
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
 * dimensiones del `buffer` de montaje inicial: si el tamaño cambiara sin
 * redimensionar tambien el `<canvas>`, `ctx.putImageData` fallaria (el
 * `ImageData` fuente ya no cabe en un canvas mas chico) o quedaria
 * recortado en silencio. El efecto de abajo redimensiona el `<canvas>`
 * cada vez que `buffer.width`/`buffer.height` no coinciden con el
 * tamaño actual, antes de volcar los pixeles.
 *
 * **Ticket 014 (bug critico -- sync 3D roto tras cambiar de resolucion,
 * causa raiz real confirmada leyendo `node_modules/three/build/three.module.js`,
 * no solo la hipotesis del ticket):** redimensionar el `<canvas>`
 * offscreen y despues solo marcar `texture.needsUpdate = true` (lo que
 * hacia este hook desde el ticket 009) NO alcanza. La cadena real de
 * three.js (`WebGLRenderer.setTexture2D` -> `uploadTexture` ->
 * `initTexture`, ver `WebGLTextures.js`): la memoria de GPU de una
 * textura (`gl.texStorage2D`, la que fija su tamaño) se reserva
 * UNICAMENTE la primera vez que se sube esa `Texture`, o cuando cambia
 * su "cache key" (`getTextureCacheKey`: filtros, formato, flipY,
 * anisotropy, colorSpace, etc.) -- ese cache key NUNCA incluye
 * ancho/alto de la imagen. Como el `<canvas>` que respalda la textura ya
 * habia subido una vez a una resolucion (ej. x1, 64x32), un resize
 * posterior (a x4, 256x128) seguido de `needsUpdate = true` NO fuerza
 * una nueva reserva de memoria: three.js reutiliza la asignacion vieja y
 * escribe (`texSubImage2D`) los pixeles nuevos sobre una textura GPU que
 * sigue siendo de 64x32 -- el resultado visual es exactamente el
 * reportado (modelo 3D congelado con el contenido de textura vigente al
 * momento del cambio de resolucion, ignorando cualquier edicion
 * posterior). Verificado en vivo instrumentando temporalmente el efecto
 * de abajo: el buffer/canvas offscreen SI tenian los pixeles nuevos
 * correctos (`ctx.getImageData` confirmaba el pixel pintado) y
 * `texture.needsUpdate`/`texture.version` SI se actualizaban en cada
 * pintado -- la ruptura esta exclusivamente del lado de la reserva de
 * memoria GPU de three.js, no en el lado de React/canvas 2D de este
 * hook.
 *
 * **Fix**: cuando el tamaño del `buffer` no coincide con el `<canvas>`
 * offscreen actual, en vez de solo redimensionar el `<canvas>` y marcar
 * `needsUpdate`, se crea una `THREE.CanvasTexture` NUEVA (misma
 * `createCanvasTexture` de arriba, mismos sampler settings) sobre el
 * mismo `<canvas>` ya redimensionado -- una instancia nueva de
 * `Texture` fuerza a three.js a tratarla como una textura nunca subida
 * (`sourceProperties.__version === undefined`), reservando memoria GPU
 * fresca del tamaño correcto (su constructor ya deja `needsUpdate = true`
 * seteado, no hace falta repetirlo). La textura VIEJA se dispone
 * automaticamente por el segundo efecto de abajo (su cleanup corre
 * cuando `texture` cambia de identidad, no solo al desmontar -- mismo
 * mecanismo que ya disponia la unica textura de toda la vida del
 * componente antes de este ticket, generalizado para tambien correr en
 * cada reemplazo). Pintar sin cambiar de tamaño (el caso normal, mucho
 * mas frecuente) sigue el camino barato de siempre: mutar el mismo
 * `<canvas>` + `needsUpdate = true`, sin crear una `Texture` nueva en
 * cada pixel pintado.
 *
 * `texture` se DERIVA con `useMemo` (no con un segundo `useState` +
 * `setState` dentro del efecto de sincronizacion): recrearla es una
 * consecuencia pura de `buffer.width`/`buffer.height` cambiando, no un
 * efecto secundario que sincronice con un sistema externo -- exactamente
 * la distincion que señala oxlint (`react/set-state-in-effect`) para
 * evitar el render en cascada innecesario de despachar `setState` desde
 * un `useEffect`.
 */
export function useCanvasTexture(buffer: TextureBuffer, version: number): THREE.CanvasTexture {
  const [canvas] = useState(() => {
    const c = document.createElement('canvas');
    c.width = buffer.width;
    c.height = buffer.height;
    return c;
  });

  const texture = useMemo(() => {
    if (canvas.width !== buffer.width || canvas.height !== buffer.height) {
      // Mutar el `<canvas>` (un elemento DOM real fuera del arbol de
      // React, no un valor inmutable de estado) es el patron idiomatico
      // ya usado en el resto de este hook para el mismo offscreen canvas
      // creado una sola vez arriba.
      // oxlint-disable-next-line react/immutability
      canvas.width = buffer.width;
      // oxlint-disable-next-line react/immutability
      canvas.height = buffer.height;
    }
    return createCanvasTexture(canvas);
  }, [canvas, buffer.width, buffer.height]);

  useEffect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(buffer.toImageData(), 0, 0);
    // Mismo caso que Viewer3D.tsx (ticket 001): mutar `needsUpdate`
    // sobre una `THREE.Texture` ya creada es el patron idiomatico de
    // three.js, no un descuido de inmutabilidad. Redundante (pero
    // inofensivo) justo despues de que `texture` se acaba de recrear
    // arriba -- su constructor ya deja `needsUpdate = true`.
    // oxlint-disable-next-line react/immutability
    texture.needsUpdate = true;
  }, [buffer, version, canvas, texture]);

  // Dispone la textura VIGENTE cada vez que deja de serlo -- tanto al
  // desmontar el componente como (ticket 014) cada vez que `useMemo`
  // de arriba la reemplaza por una nueva tras un resize: el cleanup de
  // un efecto con `[texture]` como dependencia corre con el valor
  // ANTERIOR de `texture` justo antes de que el efecto se vuelva a
  // ejecutar con el nuevo, que es exactamente cuando hay que liberar la
  // vieja.
  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return texture;
}
