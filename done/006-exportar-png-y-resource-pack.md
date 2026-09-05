# 006 — Exportar PNG y exportar ZIP del resource pack

## Objetivo
Sale de `docs/definiciones/editor-3d-texturas-esqueleto.md` (HU-10, HU-11). Botones de export: PNG suelto de la textura, y ZIP completo del resource pack.

## Alcance
- `canvas.toBlob` → descarga `skeleton.png` (64×32, alpha preservado).
- `JSZip` → `pack.mcmeta` (`pack_format`/`min_format`/`max_format` = 75) + `assets/minecraft/textures/entity/skeleton/skeleton.png` → descarga `.zip`.
- Validar en un cliente Minecraft 1.21.11 real que el pack no sale "Incompatible".

## Criterios de aceptación
Ver HU-10 y HU-11 completas en la definición.

## Hecho
Implementado por el agente `fullstack-dev` (PR [#14](https://github.com/64bitstudio/texture-studio-mc/pull/14)). CI de Jenkins en verde, sin hallazgos del gate de QA automático.

- HU-10: "Exportar PNG" descarga `skeleton.png` con exactamente los pixeles actuales del `TextureBuffer` (64×32, alpha preservado) — 100% client-side (`canvas.toBlob`).
- HU-11: "Exportar pack (.zip)" genera vía `JSZip` un ZIP con `pack.mcmeta` (`pack_format`/`min_format`/`max_format` = 75, mismo contrato ya validado en el pipeline hermano `minecraft-texture-pack-pipeline`) y `assets/minecraft/textures/entity/skeleton/skeleton.png`.
- Ambos exports leen siempre del mismo `TextureBuffer` (sin duplicar fuente de verdad) — funcionan igual sin importar si el contenido viene de pintar a mano, de un import o de un pegado (tickets 002/005).
- 68 tests en verde (frontend), lint y build en verde.
- **Verificado en vivo contra el deploy real de DEV** (el orquestador repitió la verificación tras el merge, con archivos reales descargados e inspeccionados con PIL/`unzip`): pinté un pixel distintivo, exporté el PNG y confirmé que el color coincide exactamente (161,28,17 = "Redstone"); exporté el ZIP y confirmé que `pack.mcmeta` tiene los 3 campos en 75 y que el `skeleton.png` interno es pixel-por-pixel idéntico al PNG exportado por separado.
- **Pendiente, no verificable por un agente**: el último punto del alcance del ticket ("Validar en un cliente Minecraft 1.21.11 real que el pack no sale 'Incompatible'") requiere un cliente Minecraft real — no se hizo en esta sesión. El esquema de `pack.mcmeta` es idéntico al ya usado y validado en producción por `minecraft-texture-pack-pipeline` (mismo `pack_format`/`min_format`/`max_format` = 75), lo que da alta confianza, pero queda como verificación manual pendiente de Marco antes de considerar esto 100% probado end-to-end.
- Con esto queda completo el alcance MVP original de `docs/definiciones/editor-3d-texturas-esqueleto.md` (HU-1 a HU-11). Quedan: ticket 007 (poblar el asset vanilla real, bloqueado por acceso a un client `.jar` legítimo) y ticket 008 (distorsión de texeles, pendiente de decisión de diseño).
