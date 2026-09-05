# 007 — Poblar/documentar el asset vanilla en el pipeline de despliegue

## Objetivo
Sale de `docs/definiciones/editor-3d-texturas-esqueleto.md` (riesgo abierto #3, Diseño técnico). Definir y automatizar (o documentar como paso manual único) cómo la textura vanilla real del Esqueleto llega al volumen no versionado de cada ambiente (dev/qa/prod), sin subirla nunca al repo público.

## Alcance
- Reusar el mismo mecanismo de `minecraft-texture-pack-pipeline` (extracción desde un client `.jar` legítimo, cacheado localmente).
- Documentar el paso en `docs/ARQUITECTURA.md` de este repo.
- Depende de que exista Dockerfile/compose real (ticket 001 en adelante) para saber dónde montar el volumen.

## Criterios de aceptación
- Dado un despliegue nuevo de dev/qa/prod, cuando se sigue el procedimiento documentado, entonces la app sirve la textura vanilla real del Esqueleto (no un placeholder).
