# 021 — Investigación y geometría del Creeper (+ extraer su asset vanilla real)

## Objetivo
Sale de `docs/definiciones/multi-mob-y-proyectos-guardados.md`. El Creeper tiene una anatomía nueva para este proyecto (cuerpo rectangular alto + 4 patas cortas, sin brazos ni cabeza separada visualmente aunque sí es un bone propio) — requiere investigación completa Y extraer su asset vanilla real, que a diferencia de Zombie/Araña NO está cacheado todavía.

## Metodología obligatoria (ver memoria del equipo `texture-studio-mc-metodologia-mobs` — aplica a este ticket y a cualquier mob futuro)
1. **Extrae primero el asset vanilla real** (`~/tools/minecraft-texture-pack/vanilla-cache/creeper.png` no existe todavía) usando el mismo mecanismo ya usado para los otros mobs (extracción legítima desde un client `.jar` instalado). Si no tienes acceso directo para correr esa extracción, repórtalo explícitamente como bloqueo en vez de inventar/asumir el contenido de la textura.
2. Contrasta contra [`Mojang/bedrock-samples/creeper.geo.json`](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/creeper.geo.json) (fuente oficial pública) — extrae cada bone (head, body, y las 4 patas — probablemente `leg0`-`leg3` o similar) con tamaño/posición/UV/mirror exactos.
3. Verifica empíricamente pixel a pixel contra el asset real ya extraído en el paso 1.
4. Solo con ambas fuentes cruzadas, escribe `backend/src/geometry/creeperGeometry.ts`.

## Alcance
- Geometría completa del Creeper.
- `faceLabels` razonables para sus partes.
- Agrega `creeper` a `MOB_REGISTRY`.
- Sirve el asset vanilla real localmente para desarrollo/pruebas.

## Qué NO hacer
- No inventes/aproximes la textura del Creeper con un placeholder permanente "porque no se pudo extraer" — si la extracción está bloqueada, este ticket se reporta como bloqueado (no se cierra a medias con un mob que nunca muestra su textura real).

## Verificación
- En vivo (Claude in Chrome): confirma que el modelo 3D del Creeper se ve como un creeper reconocible (cuerpo alto, 4 patas cortas, sin brazos) con su textura real aplicada correctamente.

## Criterios de aceptación
- Dado `GET /api/base-assets/creeper`, cuando se consulta, entonces devuelve la geometría real del Creeper y su textura vanilla real (no un placeholder permanente).
