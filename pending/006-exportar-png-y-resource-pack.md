# 006 — Exportar PNG y exportar ZIP del resource pack

## Objetivo
Sale de `docs/definiciones/editor-3d-texturas-esqueleto.md` (HU-10, HU-11). Botones de export: PNG suelto de la textura, y ZIP completo del resource pack.

## Alcance
- `canvas.toBlob` → descarga `skeleton.png` (64×32, alpha preservado).
- `JSZip` → `pack.mcmeta` (`pack_format`/`min_format`/`max_format` = 75) + `assets/minecraft/textures/entity/skeleton/skeleton.png` → descarga `.zip`.
- Validar en un cliente Minecraft 1.21.11 real que el pack no sale "Incompatible".

## Criterios de aceptación
Ver HU-10 y HU-11 completas en la definición.
