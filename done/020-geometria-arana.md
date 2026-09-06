# 020 — Investigación y geometría de la Araña

## Objetivo
Sale de `docs/definiciones/multi-mob-y-proyectos-guardados.md`. A diferencia del Zombie (ticket 017), la Araña tiene una anatomía que este proyecto nunca ha modelado (cabeza+tórax, 8 patas, sin brazos) — requiere investigación completa, no una copia ajustada del Esqueleto.

## Metodología obligatoria (ver memoria del equipo `texture-studio-mc-metodologia-mobs` — aplica a este ticket y a cualquier mob futuro)
1. Contrasta contra [`Mojang/bedrock-samples/spider.geo.json`](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/spider.geo.json) (fuente oficial pública) — extrae CADA bone (cabeza, cuerpo/abdomen, y cada una de las 8 patas) con su tamaño/posición/UV/mirror exactos. No asumas cuántas cajas únicas hay hasta confirmarlo (algunas patas pueden compartir/reflejar la misma región UV).
2. Verifica empíricamente pixel a pixel contra el asset vanilla real ya cacheado (`~/tools/minecraft-texture-pack/vanilla-cache/spider.png`, 64×32 confirmado) — ya hay un precedente real en `docs/ARQUITECTURA.md` de `minecraft-texture-pack-pipeline` sobre la araña ("`spider.png` vanilla es 64×32, cabeza+cuerpo en y0-23, patas en y24-31") — parte de ahí pero confírmalo tú mismo con un mapa de alpha como el ya usado para el Esqueleto, no lo des por sentado sin verificar.
3. Solo con ambas fuentes cruzadas, escribe `backend/src/geometry/spiderGeometry.ts`.

## Alcance
- Geometría completa de la Araña (todas sus cajas reales).
- `faceLabels` razonables para sus partes (cabeza, abdomen, patas — nombres que tengan sentido para el usuario, no necesariamente "Frente/Atrás/Lateral" si la forma no lo amerita).
- Agrega `spider` a `MOB_REGISTRY`.
- Sirve el asset vanilla real localmente para desarrollo/pruebas.

## Verificación
- En vivo (Claude in Chrome): confirma que el modelo 3D de la Araña se ve como una araña reconocible (no una silueta deforme) con su textura real aplicada correctamente en cada pata/región.

## Criterios de aceptación
- Dado `GET /api/base-assets/spider`, cuando se consulta, entonces devuelve la geometría real de la Araña (todas sus cajas) y su textura vanilla real.
- Dado el visor 3D con la Araña seleccionada, cuando se compara contra una referencia visual del mob real, entonces la silueta y proporciones coinciden razonablemente.

## Hecho

Implementado en PR #44 (`feature/020-geometria-arana`, mergeado a `dev`, CI Jenkins en verde) + PR de cierre.

- **Investigación** (metodología obligatoria, ver memoria `texture-studio-mc-metodologia-mobs`): geometría extraída del fetch real de `Mojang/bedrock-samples/spider.geo.json` (3 cajas de cuerpo -- `head`/`thorax`/`abdomen` -- + 8 patas compartiendo una única región UV) y verificada empíricamente pixel a pixel contra `~/tools/minecraft-texture-pack/vanilla-cache/spider.png` (64×32, ya cacheado) -- coincide exactamente. Se detectó y descartó explícitamente una nota heredada incorrecta de otro proyecto ("patas en y24-31") -- las patas reales están en las filas 0-3; las filas 24-31 son el abdomen. Ver `backend/src/geometry/spiderGeometry.ts` para el detalle fila por fila y `docs/ARQUITECTURA.md`, "Ticket 020".
- `backend/src/geometry/spiderGeometry.ts` (nuevo): geometría completa con `faceLabels` propios por segmento (Cabeza/Tórax/Abdomen/Pata, sin lateralidad en las patas).
- `spider` agregado a `MOB_REGISTRY` (`MobId` ahora `'skeleton' | 'zombie' | 'spider'`).
- **Cambio de contrato señalado explícitamente (regla 9)**: `MobGeometry.parts` se generalizó de las 6 claves fijas del biped clásico a `Record<string, MobBoxPart>`, con un nuevo campo opcional `MobBoxPart.group` (reemplaza la tabla estática `PART_GROUP_KEY` que antes vivía en `frontend/src/regionLabels.ts`, incapaz de cubrir un mob con partes de nombre arbitrario). Ensanchamiento de contrato, no ruptura -- Esqueleto y Zombie siguen devolviendo exactamente las mismas 6 claves de siempre, confirmado con la suite completa (backend + frontend) en verde sin tocar su comportamiento.
- Mejora adicional encontrada durante la implementación: `Viewer3D` apuntaba la cámara orbital a un `target` fijo `[0,16,0]`, correcto solo por coincidencia para el biped clásico. Se agregó `frontend/src/geometry/geometryBounds.ts` (`computeGeometryCenter`, puro + testeado) que lo deriva del bounding box real de cualquier geometría -- sin regresión para Esqueleto/Zombie (sigue dando `[0,16,0]`), y centra correctamente la cámara para la Araña y cualquier mob futuro.
- `spider.png` copiado a `backend/vanilla-assets/` (no versionado) para desarrollo/pruebas locales -- el despliegue del asset real a la VM (DEV/QA/PROD) es responsabilidad del ticket 022.
- Tests nuevos: `backend/test/baseAssets.spec.ts` (bloque dedicado para `spider`: 3 cajas de cuerpo, 8 patas con mismo tamaño/UV/`group`, mirror correcto por lado anatómico, `faceLabels` sin lateralidad), `frontend/test/regionLabels.spec.ts` (dedupe de un grupo de más de 2 partes vía `group` explícito), `frontend/test/geometryBounds.spec.ts` (nuevo módulo completo). `npm run lint`, `npm test`, `npm run build` en verde en backend y frontend.
- `docs/ARQUITECTURA.md`, `docs/API.md`, `docs/COMPONENTES.md` y `postman/texture-studio-mc.postman_collection.json` actualizados.

**Hallazgo visual documentado, no oculto**: las 8 patas de la Araña difieren solo 1 unidad entre sí en su eje `z` (así lo define el `.geo.json` oficial), por lo que en el visor 3D se ven visualmente amontonadas en vez de un abanico de 8 patas separadas. Esto es fiel a la pose "bind" (sin animar) oficial -- el abanico que se ve en el juego real lo produce código de animación en tiempo de ejecución (Java `SpiderModel.setupAnim`), no publicado ni verificable en ninguna fuente estática. Se decidió NO inventar una rotación sin fuente verificable (violaría la regla permanente de "investigar, nunca asumir" del Product Owner) y documentar la limitación explícitamente en vez de ocultarla.

**Verificación en vivo**:
- Local (`npm run dev`, backend apuntando a `vanilla-assets/spider.png` copiado de la cache): `GET /api/base-assets/spider` responde `isPlaceholder: false` con las 11 partes esperadas; selector de mob muestra "Araña"; editor 2D muestra la textura real con las cajas UV correctamente delimitadas (cabeza, tórax, patas, abdomen, sin solapamientos); visor 3D carga el modelo con la textura real aplicada (ojos rojos de la cabeza visibles, patrón del abdomen correcto), silueta razonablemente reconocible como araña (cuerpo segmentado + cabeza con ojos + patas laterales).
- DEV real (`https://texture-studio-dev.64bitstudio.com/`): "Araña" aparece en el menú, `GET /api/base-assets/spider` responde `200` con la geometría real (`isPlaceholder: true` esperado -- el asset vanilla real en la VM es el ticket 022), el visor 3D y el editor 2D muestran la geometría/UV correctas con la textura placeholder.
