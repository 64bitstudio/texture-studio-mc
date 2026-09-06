# 017 — Geometría e integración del Zombie

## Objetivo
Sale de `docs/definiciones/multi-mob-y-proyectos-guardados.md`. Agrega el Zombie como segundo mob del registro (ticket 016), con geometría real ya investigada y verificada en el propio documento de definición — no repitas esa investigación, verifícala.

## Alcance
- `backend/src/geometry/zombieGeometry.ts` (nuevo, mismo shape que `skeletonGeometry.ts`): mismas 6 cajas y orígenes UV que el Esqueleto, pero brazos/piernas de tamaño `[4,12,4]` (no `[2,12,2]`) — confirmado contra [`bedrock-samples/zombie.geo.json`](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/zombie.geo.json). **Verifica tú mismo esta fuente antes de escribir el archivo** (no copies el valor de memoria sin confirmar) y, si tienes acceso al asset vanilla real (`~/tools/minecraft-texture-pack/vanilla-cache/zombie.png`, ya cacheado), verifica también empíricamente pixel a pixel como se hizo para el Esqueleto (ticket 009) — mismo método, ver `docs/ARQUITECTURA.md` sección de ese ticket para el procedimiento exacto.
- Nota real ya conocida: el archivo `zombie.png` real es **64×64** (no 64×32) — confirma con el asset real si esa altura extra corresponde a capas/overlays adicionales (sleeves/pants del formato nuevo) que el Zombie vanilla NO usa (según investigación previa, "no usa la capa de overlay ni las regiones de brazo/pierna izquierdos del formato nuevo -- están vacías"), o si hay algo más que mapear. Documenta lo que encuentres.
- `faceLabels` (ticket 011) para el Zombie — mismo catálogo de nombres que el Esqueleto (Cara/Nuca/Pecho/etc.) es razonable reusar dado que la estructura de cajas es igual; documenta si haces algún ajuste.
- Agrega `zombie` a `MOB_REGISTRY` (ticket 016).
- Sirve el asset vanilla real: copia `~/tools/minecraft-texture-pack/vanilla-cache/zombie.png` al directorio de assets no versionado que use tu entorno de desarrollo local para probar (no hace falta desplegarlo a la VM en este ticket — eso es el ticket 022).

## Qué NO construir (fuera de este ticket)
- No construyas el selector de mob en el frontend todavía (ticket 018) — para verificar este ticket, puedes probar temporalmente pegando `/api/base-assets/zombie` en el navegador o con un cliente HTTP, y/o forzando el mob activo en el frontend de forma manual/temporal para la verificación visual (revierte cualquier cambio temporal del frontend antes de abrir el PR, o dilo explícitamente en el PR si decides dejar algo mínimo porque el ticket 018 lo reemplazará de todas formas).

## Verificación
- Test unitario de la geometría (dimensiones/UV/mirror correctos) si aplica al patrón ya usado para `skeletonGeometry.ts`.
- Si logras cargar el modelo del Zombie en el visor 3D (aunque sea temporalmente), verifica visualmente en vivo con Claude in Chrome que la silueta se vea correcta (brazos/piernas gruesos, como Steve, no como el Esqueleto) y que la textura real (no placeholder) se vea aplicada correctamente.

## Criterios de aceptación
- Dado `GET /api/base-assets/zombie`, cuando se consulta, entonces devuelve la geometría de 6 cajas con los tamaños/UV correctos y (si el asset está disponible localmente) la textura real del Zombie.
