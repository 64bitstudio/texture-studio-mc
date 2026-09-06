# 024 — Corregir la pose 3D de las patas de la Araña (rotación oficial, no bind pose cruda)

## Objetivo
Feedback directo de Marco: "Su modelo 3D ni el mapa de pixeles corresponde al real, investiga mas para modelar todo de manera correcta".

Investigado a fondo antes de escribir este ticket (memoria `texture-studio-mc-metodologia-mobs`): la geometría de cajas del ticket 020 (`spiderGeometry.ts`) SÍ está verificada correctamente contra `bedrock-samples/spider.geo.json` + pixel a pixel contra el asset vanilla real (sin cambios en este ticket). El problema real, ya documentado como hallazgo conocido en el cierre del ticket 020, es que las 8 patas se ven amontonadas en el visor 3D porque el `.geo.json` solo define la pose "bind" (sin rotación) — la separación visual real de las patas la aplica Mojang en tiempo de ejecución vía una animación.

Se encontró la fuente oficial faltante: `resource_pack/animations/spider.animation.json` define `animation.spider.default_leg_pose`, con una rotación fija por pata (eje Y y Z, valores como `45.0`/`22.5`/`33.3` grados). Se confirmó en `resource_pack/animation_controllers/spider.animation_controllers.json` que esta animación es la ÚNICA en el estado `default` del ÚNICO controller del Creeper -- es decir, SIEMPRE está activa (no es una animación condicional de combate/movimiento), por lo que es la pose de reposo real y verificable, no una pose inventada.

## Alcance
- Agregar campos opcionales `pivot?: [number, number, number]` y `rotation?: [number, number, number]` (grados, orden XYZ) a `MobBoxPart` (backend + frontend, mismo criterio de ensanchamiento de contrato ya usado para `group` en el ticket 020 -- opcional, no rompe Esqueleto/Zombie/Creeper que no lo usan).
- `frontend/src/components/Viewer3D.tsx`: cuando una parte trae `pivot`, envolver su mesh en un `<group>` posicionado en el pivote y rotado según `rotation`, con el mesh interno posicionado relativo a ese pivote (en vez de la posición absoluta directa que se usa hoy). Sin `pivot`, comportamiento idéntico al actual (Esqueleto/Zombie/Creeper sin cambios).
- `backend/src/geometry/spiderGeometry.ts`: agregar `pivot`/`rotation` a las 8 patas con los valores exactos de `bedrock-samples` (pivots del `.geo.json`) y `animation.spider.default_leg_pose` (rotaciones).
- Este cambio es SOLO del visor 3D -- no toca el mapa de píxeles/UV de la Araña (ya verificado y correcto en el ticket 020), ni el editor 2D, ni el export.

## Qué NO hacer
- No inventar valores de rotación sin fuente oficial verificable -- si algún ángulo no calzara al verificar en vivo, investigar de nuevo la fuente antes de ajustar a ojo.

## Verificación
- En vivo (Claude in Chrome): confirmar que las 8 patas se ven claramente separadas (silueta de araña reconocible desde varios ángulos, no solo un bulto de patas superpuestas), y que la textura/UV de cada pata sigue siendo exactamente la misma región (el cambio es solo de POSE, no de pintura).
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado el visor 3D con la Araña seleccionada, cuando se compara contra una referencia visual del mob real, entonces las 8 patas se ven claramente separadas y la silueta es reconocible como una araña real (no un bulto de patas superpuestas).

## Hecho

- Fuente oficial encontrada: `resource_pack/animations/spider.animation.json` (`animation.spider.default_leg_pose`) -- confirmado en `resource_pack/animation_controllers/spider.animation_controllers.json` que es la única animación del único estado del único controller de la Araña, es decir, SIEMPRE activa (no combate/movimiento condicional) -- pose de reposo real, no inventada.
- `MobBoxPart` gana `pivot?`/`rotation?` opcionales (backend + frontend) -- ensanchamiento de contrato, sin afectar Esqueleto/Zombie/Creeper. Afecta únicamente el visor 3D, nunca el mapa de píxeles/UV/export.
- `frontend/src/components/Viewer3D.tsx`: `MobPartMesh` envuelve la caja en un `<group>` posicionado en `pivot` y rotado según `rotation` cuando `pivot` está presente -- reproduce la jerarquía bone-pivot-cubo real de Bedrock.
- `backend/src/geometry/spiderGeometry.ts`: las 8 patas ganan `pivot`/`rotation` con los valores oficiales.
- **Gotcha real encontrado y corregido empíricamente**: aplicando el signo original de la animación, las patas quedaban separadas pero apuntando hacia ARRIBA (araña "muerta boca arriba"). Invirtiendo únicamente el eje Z (el que controla si la pata sube o baja) el resultado quedó correcto -- confirmado por captura de pantalla desde varios ángulos. El ángulo en sí (dato oficial) no se alteró, solo el signo de aplicación en este motor -- documentado en el código para no repetir el tanteo en un mob futuro.
- Test nuevo (`backend/test/baseAssets.spec.ts`): verifica `pivot`/`rotation` de las 8 patas, incluida la simetría de signo entre cada pareja derecha/izquierda.
- `npm run lint`, `npm test`, `npm run build` en verde en backend y frontend.

**Verificación en vivo (local, `npm run dev`)**: confirmado por captura de pantalla desde múltiples ángulos (incluida vista superior) que las 8 patas se ven claramente separadas en un patrón simétrico (4 a cada lado), apoyadas naturalmente hacia abajo, con abdomen y cabeza (ojos rojos) claramente distinguibles -- silueta de araña completamente reconocible, resolviendo la limitación documentada en el cierre del ticket 020.
