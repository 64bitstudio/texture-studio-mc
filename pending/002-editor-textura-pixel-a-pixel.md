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
