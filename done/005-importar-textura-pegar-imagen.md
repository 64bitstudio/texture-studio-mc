# 005 — Importar textura existente + pegar/ajustar imagen a región UV

## Objetivo
Sale de `docs/definiciones/editor-3d-texturas-esqueleto.md` (HU-8, HU-9). Permitir subir un PNG existente como punto de partida, y pegar/insertar una imagen para encajarla (reposicionar/redimensionar) en una región UV específica del modelo.

## Alcance
- Importar PNG: valida dimensiones (64×32), reemplaza el `TextureBuffer` completo.
- Pegar imagen: overlay arrastrable/redimensionable sobre el editor, "quemado" (rasterizado) a los pixeles de la región UV elegida al confirmar, respetando los límites de esa caja (no desbordar a otra caja UV — ver el gotcha ya documentado en `minecraft-texture-pack-pipeline`).

## Criterios de aceptación
Ver HU-8 y HU-9 completas en la definición.

## Hecho
Implementado por el agente `fullstack-dev` (PR [#11](https://github.com/64bitstudio/texture-studio-mc/pull/11)). CI de Jenkins en verde. El único hallazgo del gate de QA automático (`<img>` sin `alt`) fue un falso positivo verificado: el patrón coincidió con la palabra `<img>` dentro de un comentario de documentación en `decodeTexture.ts`, no con una etiqueta JSX real — el único `<img>` real del PR (`PasteImageOverlay.tsx`) ya tenía `alt` correcto. Documentado, no un silencio.

- HU-8: `ImportTextureControl` valida dimensiones exactas 64×32 y reemplaza el `TextureBuffer` completo como una unidad de undo (reutiliza `PaintHistory`, sin API nueva). Error inline (no `alert()`) si las dimensiones no coinciden.
- HU-9: `PasteImageControls`/`PasteImageOverlay` — pegar (Ctrl/Cmd+V) o subir cualquier imagen, overlay arrastrable/redimensionable, "quemado" con resampling nearest-neighbor al confirmar, recortado siempre a una única caja UV (la de mayor área de superposición) para nunca desbordar a la caja vecina — también una unidad de undo.
- 22 tests nuevos de la lógica pura (`importImage.ts`), 58/58 en verde en frontend.
- **Hallazgo real documentado (no corregido en este ticket, fuera de su alcance)**: el canvas del editor (tickets 002/004) puede renderizar texeles no cuadrados por la compresión `max-width: 100%` del sidebar de ancho fijo sin ajustar la altura — el overlay de HU-9 ya compensa esto midiendo la escala real vía `ResizeObserver`, pero la distorsión visual del propio canvas sigue ahí. Propuesto como ticket futuro (opciones: ensanchar el sidebar, bajar el zoom default, o `aspect-ratio` real) — no bloquea nada de lo ya construido.
- **Verificado en vivo contra el deploy real de DEV** (el orquestador repitió la verificación tras el merge, con imágenes de prueba reales): importar un PNG 64×32 válido reemplaza la textura y se refleja en el 3D; un PNG con dimensiones incorrectas (40×20) se rechaza con mensaje inline claro; pegar una imagen de 10×10, arrastrarla hasta que quede a caballo entre la caja de la cabeza y la del torso, y confirmarla, la "quema" recortada ÍNTEGRAMENTE dentro de la caja de la cabeza (sin filtrarse al torso) y se refleja en el modelo 3D; un solo "Deshacer" revierte tanto el import como el pegado.
- Pendiente, explícitamente fuera de este ticket: exportar PNG/ZIP (006).
