# 018 — Selector de mob en el frontend

## Objetivo
Sale de `docs/definiciones/multi-mob-y-proyectos-guardados.md` (HU-1, HU-2). Con el backend ya sirviendo un catálogo de mobs (ticket 016) y al menos Esqueleto+Zombie (ticket 017), agrega el menú de selección al frontend.

## Alcance
- Componente de menú/selector que consulta `GET /api/mobs` y muestra las opciones disponibles.
- Al seleccionar un mob, la app hace `GET /api/base-assets/:mobId` y recarga el visor 3D + editor de textura con la geometría/textura de ESE mob — reusa toda la infraestructura ya existente (`textureBuffer.ts`, `Viewer3D.tsx`, `TextureEditor.tsx`, etc.), que ya es agnóstica a la geometría específica.
- Si el usuario ya había pintado algo en un mob durante la sesión y cambia a otro mob y luego regresa, el trabajo del primer mob debe seguir ahí (no se pierde solo por cambiar de selección) — mantén un buffer en memoria por mob visitado en la sesión, no solo el del mob activo.
- Actualiza `docs/COMPONENTES.md`.

## Qué NO construir (fuera de este ticket)
- No implementes Araña/Creeper en el registro — el menú debe mostrar los mobs que el backend REALMENTE tenga en ese momento (Esqueleto, Zombie), sin hardcodear una lista de 4 en el frontend.
- No implementes guardado de proyectos (ticket 019) — el mantener-buffers-por-mob-en-memoria de este ticket es solo para la sesión activa, no persistencia.

## Verificación
- En vivo (Claude in Chrome): selecciona Esqueleto, pinta algo, cambia a Zombie, confirma que carga el modelo/textura del Zombie (no el del Esqueleto), pinta algo ahí también, vuelve a Esqueleto y confirma (con `getImageData`, no solo visual) que tu pintura anterior del Esqueleto sigue intacta.
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
Ver HU-1 y HU-2 completas en la definición.

## Hecho
Implementado por el agente `fullstack-dev` (PR [#40](https://github.com/64bitstudio/texture-studio-mc/pull/40)). CI de Jenkins en verde a la primera, sin hallazgos del gate de QA automático.

- `MobSelector` genérico (consume `GET /api/mobs`, sin ningún mob hardcodeado) + `App.tsx` orquestando el catálogo y un `bufferCache` (`Map<string, TextureBuffer>`) por mob visitado en la sesión.
- `Editor` se remonta por mob (`key={mobId}`) — resetea intencionalmente estado de UI (zoom, historial, simetría, parte aislada) pero rescata el `TextureBuffer` del cache, no lo pierde.
- Rename `Skeleton*`→`Mob*` en tipos del frontend (mismo criterio ya aplicado en el backend, ticket 016).
- **Verificado en vivo contra el deploy real de DEV** (el orquestador repitió la verificación tras el merge, con `getImageData`): pinté `(1,2)` en Esqueleto → rojo exacto; cambié a Zombie (textura 64×64, placeholder esperado — asset real es el ticket 022), pinté `(8,11)` → rojo exacto; volví a Esqueleto y `getImageData(1,2)` siguió exactamente `(161,28,17,255)`, sin contaminación entre mobs.
- Pendiente, explícitamente fuera de este ticket: guardado de proyectos (019), Araña/Creeper (020/021), asset real de Zombie en la VM (022).
