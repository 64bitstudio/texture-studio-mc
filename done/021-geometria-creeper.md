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

## Hecho

Implementado en PR #46 (`feature/021-geometria-creeper`, mergeado a `dev`, CI Jenkins en verde) + PR de cierre.

- **Paso 0 (extracción del asset vanilla real)**: `creeper.png` no estaba cacheado. Se confirmó acceso legítimo -- esta Mac tiene un client de Minecraft 1.21.11 instalado (`~/Library/Application Support/minecraft/versions/1.21.11/1.21.11.jar`) -- y se extrajo `assets/minecraft/textures/entity/creeper/creeper.png` de ese `.jar` (mismo mecanismo ya usado para los demás mobs). No fue necesario reportar bloqueo.
- **Investigación**: geometría extraída del fetch real de `Mojang/bedrock-samples/creeper.geo.json` (`head`+`body`+4 patas `leg0`-`leg3`, todas compartiendo tamaño/UV) y verificada empíricamente pixel a pixel contra el asset recién extraído -- coincide exactamente. Diferencia real respecto a la Araña (ticket 020): ninguna de las 4 patas declara `mirror` en la fuente oficial -- se preservó tal cual, sin inventar una simetría que la fuente no tiene. Ver `backend/src/geometry/creeperGeometry.ts` para el detalle completo y `docs/ARQUITECTURA.md`, "Ticket 021".
- `backend/src/geometry/creeperGeometry.ts` (nuevo): `head`, `body`, y 4 patas (`legFrontRight`/`legFrontLeft`/`legBackRight`/`legBackLeft`) compartiendo `group: 'creeperLeg'`.
- `creeper` agregado a `MOB_REGISTRY` (`MobId` ahora incluye `'creeper'`).
- `creeper.png` copiado a `backend/vanilla-assets/` (no versionado) para desarrollo/pruebas locales -- el despliegue del asset real a la VM (DEV/QA/PROD) es responsabilidad del ticket 022, junto con Zombie y Araña.
- Tests nuevos: `backend/test/baseAssets.spec.ts` (bloque dedicado para `creeper`, incluyendo assert explícito de que ninguna pata tiene `mirrorX`), `backend/test/mobs.spec.ts` actualizado. `npm run lint`, `npm test`, `npm run build` en verde en backend y frontend.
- `docs/ARQUITECTURA.md`, `docs/API.md`, `docs/COMPONENTES.md` y `postman/texture-studio-mc.postman_collection.json` actualizados.

**Hallazgo positivo (sin limitaciones que documentar, a diferencia de la Araña)**: las 4 patas del Creeper tienen posiciones bien separadas (`±2, ±4`), a diferencia de las 8 patas de la Araña que diferían solo 1 unidad entre sí -- el modelo en bind pose (sin ninguna rotación) ya se ve como un Creeper reconocible de inmediato, sin ningún hallazgo/limitación visual que reportar.

**Verificación en vivo**:
- Local (`npm run dev`, backend apuntando a `vanilla-assets/creeper.png` recién extraído): `GET /api/base-assets/creeper` responde `isPlaceholder: false` con las 6 partes esperadas; selector de mob muestra "Creeper"; visor 3D muestra un Creeper inmediatamente reconocible (cara fruncida característica, camuflaje verde, cuerpo alto, 4 patas cortas claramente separadas en las 4 esquinas) -- cumple el criterio de aceptación completo (geometría real + textura vanilla real, no placeholder).
- DEV real (`https://texture-studio-dev.64bitstudio.com/`): "Creeper" aparece en el menú, `GET /api/base-assets/creeper` responde `200` con la geometría real (`isPlaceholder: true` esperado en este entorno -- el asset vanilla real en la VM es el ticket 022, no un incumplimiento del criterio de aceptación de este ticket, que es sobre la capacidad del backend de servir la textura real cuando el archivo existe, ya probada localmente).
