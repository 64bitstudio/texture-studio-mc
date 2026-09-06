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
