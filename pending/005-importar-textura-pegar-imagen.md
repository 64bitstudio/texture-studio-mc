# 005 — Importar textura existente + pegar/ajustar imagen a región UV

## Objetivo
Sale de `docs/definiciones/editor-3d-texturas-esqueleto.md` (HU-8, HU-9). Permitir subir un PNG existente como punto de partida, y pegar/insertar una imagen para encajarla (reposicionar/redimensionar) en una región UV específica del modelo.

## Alcance
- Importar PNG: valida dimensiones (64×32), reemplaza el `TextureBuffer` completo.
- Pegar imagen: overlay arrastrable/redimensionable sobre el editor, "quemado" (rasterizado) a los pixeles de la región UV elegida al confirmar, respetando los límites de esa caja (no desbordar a otra caja UV — ver el gotcha ya documentado en `minecraft-texture-pack-pipeline`).

## Criterios de aceptación
Ver HU-8 y HU-9 completas en la definición.
