# 007 — Poblar/documentar el asset vanilla en el pipeline de despliegue

## Objetivo
Sale de `docs/definiciones/editor-3d-texturas-esqueleto.md` (riesgo abierto #3, Diseño técnico). Definir y automatizar (o documentar como paso manual único) cómo la textura vanilla real del Esqueleto llega al volumen no versionado de cada ambiente (dev/qa/prod), sin subirla nunca al repo público.

## Alcance
- Reusar el mismo mecanismo de `minecraft-texture-pack-pipeline` (extracción desde un client `.jar` legítimo, cacheado localmente).
- Documentar el paso en `docs/ARQUITECTURA.md` de este repo.
- Depende de que exista Dockerfile/compose real (ticket 001 en adelante) para saber dónde montar el volumen.

## Criterios de aceptación
- Dado un despliegue nuevo de dev/qa/prod, cuando se sigue el procedimiento documentado, entonces la app sirve la textura vanilla real del Esqueleto (no un placeholder).

## Hecho
Implementado por el orquestador (PR [#16](https://github.com/64bitstudio/texture-studio-mc/pull/16)). CI de Jenkins en verde, sin hallazgos del gate de QA automático.

- No hizo falta extraer nada nuevo: ya existía `skeleton.png` vanilla real cacheado en `~/tools/minecraft-texture-pack/vanilla-cache/` (extraído legítimamente por `minecraft-texture-pack-pipeline`, mismo mecanismo previsto por este ticket).
- Directorio nuevo en la VM, separado de `/home/ubuntu/secrets/` a propósito (no es un secreto): `/home/ubuntu/vanilla-assets/texture-studio-mc/skeleton.png`, montado read-only en `/app/vanilla-assets` de los 3 `docker-compose.*.yml` — mismo path que ya esperaba el backend desde el ticket 001, compartido entre dev/qa/prod (mismo asset público, no varía por ambiente).
- **Decisión de producto señalada explícitamente antes de ejecutar, con VoBo de Marco (no asumida)**: montar el asset real cambia el nivel de exposición pública aceptado en la definición original (el riesgo "acceso público sin auth" se había aceptado asumiendo solo un placeholder) — Marco confirmó exponer el asset real en los 3 ambientes, incluido el público sin auth.
- **Verificado en vivo contra el deploy real de DEV**: `GET /api/base-assets/skeleton` responde `isPlaceholder: false`; el visor 3D muestra la textura real del Esqueleto vanilla (cráneo con ojos, costillas, huesos de piernas visibles) en vez del placeholder gris con grid.
- Con esto quedan resueltos todos los tickets del backlog original salvo el 008 (mejora de UX, pendiente de decisión de diseño de Marco).
