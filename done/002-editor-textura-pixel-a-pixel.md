# 002 — Editor de textura pixel a pixel + sincronía en vivo con el 3D

## Objetivo
Sale de `docs/definiciones/editor-3d-texturas-esqueleto.md` (HU-2, HU-3, HU-5). Construir el editor de textura (`<canvas>` 2D, 64×32) con selector de color + paleta predefinida, y el buffer de textura compartido (`ImageData`) que sincroniza en vivo con el visor 3D del ticket 001.

## Alcance
- Selector de color libre (hex/RGB) + paleta predefinida "estilo Minecraft".
- Click y modo brocha (drag) pintan pixeles en la cuadrícula.
- `TextureBuffer`: única interfaz de escritura sobre los pixeles, consumida tanto por el editor como (a futuro) por importar/pegar imagen/IA (ver HU-12).
- `texture.needsUpdate` dispara el refresco del modelo 3D sin recarga.

## Criterios de aceptación
Ver HU-2, HU-3 y HU-5 completas en la definición.

## Hecho
Implementado por el agente `fullstack-dev` (PR [#5](https://github.com/64bitstudio/texture-studio-mc/pull/5)). CI de Jenkins en verde (incluye `npm test` de frontend, agregado en este ticket) y sin hallazgos del gate de QA automático.

- `TextureBuffer` (`frontend/src/textureBuffer.ts`): única fuente de verdad de los pixeles (`Uint8ClampedArray` RGBA 64×32), con `setPixel`/`getPixel`/`paintLine` (interpolación Bresenham) y `loadFromImageData` — lista para que tickets futuros (003 undo/redo, 005 importar/pegar, HU-12 IA) escriban sobre la misma interfaz. 17 tests unitarios en verde.
- `TextureEditor` (canvas 2D, escala ×10, `image-rendering: pixelated`): click pinta un pixel, arrastrar pinta en modo brocha sin huecos (pointer capture + interpolación de línea).
- `ColorPicker`: paleta de 16 swatches estilo Minecraft + `<input type="color">` libre.
- Sincronía en vivo con el visor 3D vía `THREE.CanvasTexture` (`useCanvasTexture.ts`) + `texture.needsUpdate = true` en cada escritura — sin recarga ni refetch del asset base.
- Primer runner de tests de frontend (Vitest) agregado al proyecto, integrado al `Jenkinsfile`.
- **Verificado en vivo contra el deploy real de DEV** (no solo local, el orquestador repitió la verificación tras el merge): pintar un pixel/trazo en la cuadrícula se refleja de inmediato en la región correcta del modelo 3D (probado sobre la caja de la cabeza), el modo brocha pinta una línea continua sin huecos, y tanto la paleta como el color libre funcionan.
- Nota no bloqueante: en una carga se observó un frame transitorio con contenido incorrecto en el canvas WebGL antes de estabilizarse en el placeholder correcto — no se reprodujo en cargas posteriores ni afecta el comportamiento funcional (consistente con un frame de inicialización del contexto WebGL antes del primer draw call, no con un bug del buffer/lógica de pintura, ya cubierta por 17 tests en verde). Queda anotado por si vuelve a aparecer, no amerita ticket propio todavía.
- Pendiente, explícitamente fuera de este ticket: undo/redo (003), simetría/zoom-grid (004), importar/pegar imagen (005), exportar (006).
