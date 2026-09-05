# Arquitectura — Texture Studio MC

Ver `docs/definiciones/editor-3d-texturas-esqueleto.md` (documento de definición con VoBo) para el diseño técnico completo y los diagramas. Este archivo se amplía conforme el desarrollo real avanza y se toman decisiones que no estaban en la definición original.

## Resumen

- Toda la edición (pintar pixel a pixel) y toda la exportación (PNG y ZIP) ocurren **100% en el navegador** — sin round-trip al backend (tickets 002-006).
- El backend (`backend/`, Express + TypeScript) es deliberadamente mínimo: sirve el build estático del frontend y el asset vanilla base (geometría + textura del Esqueleto) vía un único endpoint.
- **La textura vanilla real (`skeleton.png`) NO vive en este repo** — es un asset de Mojang. Se sirve desde un directorio fuera de git, poblado por Marco a partir de un client `.jar` legítimamente instalado (mismo mecanismo que `~/tools/minecraft-texture-pack/vanilla-cache/` del pipeline hermano `minecraft-texture-pack-pipeline`). La geometría/UV del modelo (coordenadas de las cajas) sí se versiona — es información pública del formato, no un asset con copyright.
- Sin autenticación ni persistencia server-side en el MVP (decisiones explícitas, ver definición).
- Despliegue: mismo patrón `Jenkinsfile` + Shared Library `platform`, Traefik, ramas `dev`/`qa`/`prod`, que `auth-core-mc`/`mail-core-mc`.

## Ticket 001 — Scaffold + Visor 3D del Esqueleto vanilla

### Textura base del Esqueleto: placeholder vs. asset real

`GET /api/base-assets/skeleton` (ver `docs/API.md`) sirve la textura leyendo `vanilla-assets/skeleton.png` (directorio no versionado, ver `.gitignore`). Ese directorio **no existe todavía en ningún ambiente** (ticket 007 define cómo poblarlo desde un client `.jar` legítimo). Mientras tanto, `backend/src/services/skeletonTexture.ts` cae automáticamente a un **placeholder 100% procedural** generado en memoria por `backend/src/services/placeholderTexture.ts` (`pngjs`, sin dependencias nativas): una cuadrícula tenue sobre un color sólido tipo hueso/gris claro, deliberadamente distinguible a simple vista de cualquier textura real de Mojang. Este fallback:

- Nunca lanza ni responde con error — cualquier fallo de lectura del archivo real (no existe, permisos, lo que sea) cae al placeholder, nunca a un 500.
- Se señala en la respuesta vía `texture.isPlaceholder: true/false`, y el frontend muestra un badge visible cuando está activo (ver `frontend/src/App.tsx`).
- Convención del path dentro del contenedor: `WORKDIR /app` → `/app/vanilla-assets/skeleton.png` (configurable vía `VANILLA_ASSETS_DIR`). El ticket 007 es quien agrega el volumen real de host a `deploy/docker-compose.*.yml` montado ahí — este ticket solo deja el punto de extensión ya funcionando y documentado (sin ese volumen montado, el comportamiento observable es "siempre placeholder", que es exactamente el estado esperado hoy).

### Mapeo UV de cajas (formato clásico 64×32)

El modelo se construye con 6 `THREE.BoxGeometry` (head, body, armRight, armLeft, legRight, legLeft) posicionadas según `backend/src/geometry/skeletonGeometry.ts` (servidas al frontend vía el endpoint, no hardcodeadas ahí — ver "Contrato de `GET /api/base-assets/skeleton`" abajo). Las coordenadas UV y las dimensiones/posiciones de caja son las mismas ya calibradas y en uso por el pipeline hermano `~/tools/minecraft-texture-pack/mc_render_preview.py` (`BOXES` / `UV_OLD_64x32`) — información pública del formato de modelo de Minecraft, no un asset de Mojang.

`frontend/src/geometry/applyBoxUV.ts` aplica el UV "cross" clásico sobre cada `BoxGeometry`. La correspondencia exacta entre el orden de vértices que genera `THREE.BoxGeometry` (grupos de material `px, nx, py, ny, pz, nz`) y las 6 regiones del cross se **derivó y verificó vértice-por-vértice** contra `face_corners_3d()` de `mc_render_preview.py` (mismo criterio de "no adivinar, verificar contra la fuente ya calibrada" que ese propio script documenta en su cabecera). Resultado: para las 6 caras, el patrón de asignación es uniforme —

```
v0 -> (x0, y0)   (top-left del rect de esa cara)
v1 -> (x1, y0)   (top-right)
v2 -> (x0, y1)   (bottom-left)
v3 -> (x1, y1)   (bottom-right)
```

`mirrorX` (usado en `armLeft`/`legLeft`): el formato legado 64×32 no tiene una región UV propia para el lado izquierdo de brazo/pierna — el juego reutiliza la misma región del lado derecho, **reflejada horizontalmente en las 6 caras** (no solo en las caras laterales). Replica exactamente el `mirror: True` de `UV_OLD_64x32["left_arm"/"left_leg"]` en el script de referencia (rects "right"/"left" intercambiados + flip horizontal uniforme). Verificado visualmente (Claude in Chrome, ver checklist de cierre): el modelo renderiza correctamente cabeza/cuerpo/ambos brazos/ambas piernas en la silueta clásica del biped.

### Hallazgo real: canvas de `@react-three/fiber` transparente por default

Al montar el visor por primera vez, el modelo no se veía (canvas completamente negro, sin errores en consola ni en la red). Causa: `<Canvas>` de `@react-three/fiber` crea el contexto WebGL sin `scene.background` configurado — el canvas queda transparente y, sobre el fondo oscuro de la página (`--bg` en `index.css`), es indistinguible de "nada renderizando". Fix: `<color attach="background" args={['#2b2d36']} />` dentro del `<Canvas>` (ver `frontend/src/components/Viewer3D.tsx`). Verificado en vivo (Claude in Chrome): con el color de fondo, el modelo aparece correctamente; sin él, permanece invisible pese a que la geometría/textura ya eran correctas. Documentado aquí para que ningún ticket futuro repita el mismo diagnóstico desde cero.

### Contrato de `GET /api/base-assets/skeleton`

El documento de definición y el ticket 001 no especificaban la forma exacta del contrato de este endpoint (solo "devuelve la textura base + la definición de geometría/UV", en un único endpoint — así ya listado en `postman/texture-studio-mc.postman_collection.json` antes de este ticket). Decisión tomada en este ticket: un único `GET` devuelve tanto la textura (como `data:image/png;base64,...`, para no necesitar un segundo endpoint/request de imagen estática) como la definición completa de geometría (tamaños/posiciones/origen UV/`mirrorX` de las 6 cajas) — ver `docs/API.md` para el shape completo. La geometría vive como fuente de verdad en el backend (`backend/src/geometry/skeletonGeometry.ts`) y el frontend la consume tal cual (sin geometría hardcodeada en el cliente), preparando el terreno para que un futuro mob/bloque solo requiera cambiar el backend.

### Build de la imagen: frontend + backend en un solo Dockerfile — restricción real de `corePipeline`

`corePipeline.groovy` (Shared Library de Jenkins) corre siempre `docker build ... ./backend` — el contexto de build **está fijo y no es configurable por proyecto** (ver el propio Jenkinsfile de `mail-core-mc`/`auth-core-mc`, que tampoco lo parametrizan). Ese contexto nunca incluye el directorio hermano `frontend/`, así que un `COPY frontend/...` dentro de `backend/Dockerfile` es imposible (Docker no permite `COPY` fuera del contexto de build).

Decisión de este ticket (no estaba resuelta en la definición ni en el ticket): el build del frontend (`npm ci && npm run build`) ocurre en el propio `buildAndTest` del `Jenkinsfile` raíz, **antes** de que corePipeline invoque `docker build ./backend`, y su `dist/` se copia a `backend/public/` (directorio no versionado salvo un `.gitkeep`, ver `.gitignore`) dentro del mismo workspace de Jenkins. `backend/Dockerfile` solo empaqueta lo que ya está en `backend/` en ese momento — es multi-stage para el propio backend (compilación TS → runtime sin devDependencies), pero no puede serlo para el frontend por la restricción de contexto de arriba. Verificado en local: `docker build -t texture-studio-mc:test ./backend` (con `backend/public/` ya poblado a mano, simulando el paso de Jenkins) construye y corre correctamente, sirviendo SPA + `/health` + `/api/base-assets/skeleton`.

Alternativa descartada: anidar `frontend/` dentro de `backend/` para permitir un Dockerfile multi-stage "puro" — se descartó por romper la estructura de proyecto esperada (frontend/backend como directorios hermanos de primer nivel, igual que el resto de tickets de este mismo proyecto los referencian) a cambio de un beneficio marginal (un solo Dockerfile en vez de un paso extra en el Jenkinsfile).

### Sin base de datos: `skipVaultSecrets: true`

Este proyecto no tiene persistencia server-side (ver `docs/BASE_DE_DATOS.md`) — a diferencia de `auth-core-mc`/`mail-core-mc`, no hay ningún secreto (`DB_PASSWORD` u otro) que buscar en Vault (`secret/texture-studio-mc/<env>` nunca va a existir, no porque falte migrarlo sino porque no hay nada que guardar ahí). El `Jenkinsfile` raíz pasa `skipVaultSecrets: true` a `corePipeline` — sin este flag, `fetchAndPatchDbPasswordFromVault` fallaría ruidosamente en cada deploy buscando un secreto que nunca va a existir.

### Convenciones de la VM (puertos)

Puertos de host reservados por este proyecto (coordinado con `auth-core-mc`: 8080/8081/8082, y `mail-core-mc`: 8083/8084/8085 — ver `auth-core-mc/docs/ARQUITECTURA.md`, "Convenciones de la VM"): **PROD 8086 / DEV 8087 / QA 8088**.

### Bootstrap manual real hecho en la VM (build #2 de `dev`, 2026-09-05)

El primer build real en la rama `dev` (build #2) confirmó dos pasos manuales que todo proyecto nuevo necesita una sola vez, ninguno cubierto automáticamente por `sync-vm-infra` (ver `platform/.github/workflows/ci.yml`, comentario "cubierto en cuanto Marco cree su carpeta de secrets, sin tocar este workflow" — es deliberado, no un hueco):

1. **`/home/ubuntu/secrets/texture-studio-mc/.env.{dev,qa,prod}`**: sin este archivo, `docker compose --env-file ... up -d` falla con `couldn't find env file`. Este proyecto no tiene secretos reales (ver "Sin base de datos" arriba), así que los 3 archivos solo llevan un comentario explicativo — creados con el mismo `chown ubuntu:ubuntu` + `chmod 750`/`640` que ya usan `auth-core-mc`/`mail-core-mc`.
2. **Registros DNS** (`texture-studio`, `texture-studio-qa`, `texture-studio-dev` . `64bitstudio.com`, tipo A → `159.54.153.37`, sin proxy de Cloudflare, mismo patrón que `auth`/`mailcore`/`sonarqube`): sin ellos, `certbot --nginx` falla con `NXDOMAIN` (el pipeline lo trata como advertencia no bloqueante, pero sin DNS nunca hay HTTPS real). Creados vía la API de Cloudflare con el `CLOUDFLARE_API_TOKEN` ya existente en `~/dev-infra/.env` (mismo token que gestiona el resto del DNS de `64bitstudio.com`), con VoBo explícito de Marco antes de tocar el dominio compartido.

**Confirmado, no era un riesgo real**: `texture-studio-mc` sí quedó registrado en SonarQube (`waitForQualityGate` resolvió `SUCCESS`/`OK` en segundos en el build #2, no colgó hasta el timeout) — el punto de duda que dejó el ticket 001 queda cerrado.

### `vanilla-assets/` (fuera de alcance de este ticket)

Este ticket define el path de contenedor (`/app/vanilla-assets`) pero no agrega el volumen de host a `deploy/docker-compose.*.yml` — eso es alcance explícito del ticket 007. Hasta que corra ese ticket, todos los ambientes sirven el placeholder (comportamiento esperado, no un bug).

## Ticket 002 — Editor de textura pixel a pixel + sincronía en vivo con el 3D

### `TextureBuffer`: núcleo puro, sin React/DOM/three.js

Decisión de diseño (HU-12: arquitectura extensible hacia fuentes de escritura futuras): `frontend/src/textureBuffer.ts` es una clase que envuelve un `Uint8ClampedArray` RGBA plano, sin ninguna dependencia de React, del DOM ni de three.js — salvo `toImageData()`, el único método que construye un `ImageData` real (exclusivo del navegador). Esto permite:

- Testear con Vitest en `environment: 'node'` (sin jsdom) la lógica que realmente importa: `setPixel`, `paintLine` (interpolación de línea del modo brocha), `loadFromImageData` — ver `frontend/test/textureBuffer.spec.ts`.
- Que cualquier fuente de escritura futura (importar PNG del ticket 005, pegar/ajustar imagen del ticket 005, una eventual generación por IA de HU-12) escriba a través de la misma interfaz (`setPixel`/`paintLine`/`loadFromImageData`), sin volver a acoplar lógica de pintado al manejo de eventos de mouse de `TextureEditor`.

`setPixel`/`paintLine` tratan las coordenadas fuera de rango como no-op seguro (devuelven `false`/lista vacía, nunca lanzan) porque el modo brocha puede generar celdas fuera de la cuadrícula si el cursor sale del `<canvas>` mientras se arrastra (el pointer capture del editor sigue entregando eventos `pointermove` aun fuera de los límites visuales). `getPixel` sí lanza fuera de rango — es una lectura puntual explícita, no una escritura derivada de un evento de UI.

### Modo brocha: interpolación con Bresenham, no solo "pintar la celda actual"

El criterio de aceptación de HU-2 exige que arrastrar el mouse pinte "todas las celdas recorridas", incluyendo cuando el cursor se mueve más rápido que la frecuencia de eventos `pointermove` del navegador (a mayor velocidad de arrastre, más se espacian los eventos, y una implementación naive que solo pinta `(x,y)` de cada evento deja huecos). `bresenhamLine` (algoritmo de Bresenham, solo aritmética entera) interpola la línea completa entre la última celda pintada y la celda actual; `TextureEditor` llama `TextureBuffer.paintLine(last, current, color)` en cada `pointermove` en vez de `setPixel` suelto. Verificado con tests para líneas diagonales, predominantemente horizontales/verticales y con extremos fuera de rango (recorte seguro).

### Sincronía con el visor 3D: `THREE.CanvasTexture`, no `THREE.DataTexture`

El ticket sugiere "una `ImageData`/buffer... que también es la fuente de la `THREE.Texture`". Se evaluaron dos formas de conectar el `TextureBuffer` (un `Uint8ClampedArray` plano) a three.js:

1. `THREE.DataTexture` directamente sobre el mismo array — evita una copia/`putImageData` extra.
2. `THREE.CanvasTexture` sobre un `<canvas>` offscreen al que se le hace `ctx.putImageData(buffer.toImageData(), 0, 0)` en cada cambio — una copia extra, pero mismo tipo de objeto (`THREE.Texture`) que ya usaba `useLoader(TextureLoader, dataUrl)` en el ticket 001.

Se eligió la opción 2 (`useCanvasTexture`, ver `frontend/src/hooks/useCanvasTexture.ts`) porque `THREE.DataTexture` trae `flipY = false` por default, mientras que `THREE.Texture`/`CanvasTexture` traen `flipY = true` — y el mapeo UV de `applyBoxUV.ts` (ticket 001) ya fue derivado, calibrado y **verificado visualmente** asumiendo ese `flipY = true` (la convención `pyToV = 1 - py/textureHeight` da por hecho que three.js voltea la imagen al subirla a GPU, igual que hacía `TextureLoader` con la imagen del `dataUrl`). Usar `DataTexture` sin corregir `flipY` habría invertido verticalmente el modelo ya validado en el ticket 001, un regreso silencioso a un bug ya resuelto. El costo de la copia extra (`putImageData` de 64×32 = 2048 pixels) es insignificante en cada escritura.

`useCanvasTexture` crea el `<canvas>` y la `CanvasTexture` una sola vez por sesión (inicializadores perezosos de `useState`, no lectura de refs durante el render — evita el warning `react(refs)` de `oxlint`) y las resincroniza (`ctx.putImageData` + `texture.needsUpdate = true`) en un `useEffect` con `version` en las dependencias. `version` es un contador que `Editor.tsx` incrementa solo cuando una escritura al buffer realmente cambió algo (`setPixel`/`paintLine` devuelven si hubo cambio real), evitando resincronizaciones innecesarias.

### Carga inicial: la textura base se decodifica ANTES de pasar a estado "ready"

`Editor.tsx` solo se monta cuando `App.tsx` ya resolvió `GET /api/base-assets/skeleton` (igual que en el ticket 001), pero el `dataUrl` (PNG) todavía necesita decodificarse a pixeles crudos (`ImageData`) para poblar el `TextureBuffer` — un paso asíncrono (`Image.onload`) que no existía en el ticket 001 (ahí `useLoader`+`Suspense` de three.js absorbían esa espera). Decisión: ese decode ocurre dentro de `Editor.tsx` (no bloquea el estado `loading` de `App.tsx`, que ya terminó) — mientras decodifica, el buffer arranca en ceros (transparente) y el visor 3D/editor se ven brevemente en blanco hasta que el `useEffect` de carga inicial termina y sube `version`. Se consideró bloquear todo el árbol tras un segundo estado de carga en `App.tsx`, pero el decode de un PNG de 64×32 es prácticamente instantáneo (unos pocos milisegundos) — no se justificó la complejidad extra de una segunda máquina de estados de carga para una ventana de tiempo imperceptible en la práctica.

### Alpha fijo en 255 (sin herramienta de transparencia/borrador en este ticket)

HU-5 pide que el color pintado sea exacto "incluyendo alpha si aplica". El ticket 002 no pide un borrador ni control de opacidad, y `<input type="color">` nativo no expone canal alfa — decisión: tanto la paleta predefinida como el selector libre producen siempre `alpha = 255` (`colors.ts`, `hexToRgba`). El requisito de HU-5 se cumple trivialmente (el alpha usado es siempre exactamente el que corresponde, 255, no hay caso donde debiera ser otro en el alcance de este ticket). Una herramienta de borrador/transparencia queda fuera de alcance — no estaba pedida y se habría sido over-engineering agregarla sin un ticket/HU que la cubra explícitamente.

### Escala de presentación fija (×10), sin controles de zoom (superado por el ticket 004)

`TextureEditor` renderiza el `<canvas>` con backing store real de 64×32 (mismas dimensiones que el buffer, para que cada pixel del canvas sea exactamente un pixel de textura) y lo escala por CSS a 640×320 con `image-rendering: pixelated` (equivalente CSS de `imageSmoothingEnabled = false` para el escalado de *presentación* — el contexto 2D también fija `imageSmoothingEnabled = false` por si en el futuro se agrega algún `drawImage` escalado). El factor ×10 es una constante fija (`DISPLAY_SCALE`) — zoom/grid ajustable es alcance explícito del ticket 004, no se construyó ningún control de zoom aquí para no adelantarse a ese ticket.

**Actualizado en el ticket 004:** `DISPLAY_SCALE` ya no existe — el factor de escala es la prop `zoom` (variable, ver `frontend/src/zoom.ts` y "Ticket 004" mas abajo), con `ZOOM_DEFAULT = 10` preservando exactamente esta misma apariencia por default. El mecanismo de escalado en si (backing store nativo + CSS + `image-rendering: pixelated`) no cambio.

### `Viewer3D`: cambio de contrato (ya no hace fetch/decode propio)

El ticket 001 le pasaba a `Viewer3D` la respuesta completa (`data: SkeletonBaseAssetsResponse`) y el propio componente decodificaba el `dataUrl` vía `useLoader(TextureLoader, ...)` + `Suspense`. Desde el ticket 002, `Viewer3D` recibe `texture: THREE.Texture` y `geometry: SkeletonGeometry` ya resueltos — la textura viene de `useCanvasTexture` en `Editor.tsx`, compartida con `TextureEditor` a través del mismo `TextureBuffer`. Es un cambio de contrato interno del frontend (no de la API HTTP, que no cambió) — documentado aquí porque un ticket futuro que reintroduzca `Viewer3D` en otro contexto (ej. previsualizar otro mob) debe seguir este mismo patrón en vez de volver a acoplar fetch+decode+render en un solo componente.

## Ticket 003 — Deshacer / rehacer (undo/redo)

100% cliente, sin cambios de API/backend (el historial vive solo en memoria del navegador, igual que el `TextureBuffer` — sin persistencia entre sesiones, decisión explícita del ticket).

### Granularidad del historial: un trazo completo, no cada pixel

El ticket dejaba la granularidad a criterio de este ticket ("decide tú la granularidad razonable"). Decisión: **un trazo completo — desde `pointerdown` hasta `pointerup`/`pointercancel` — es una unidad de historial**, no cada pixel individual dentro del arrastre. Es el comportamiento esperado de cualquier editor de pixel art (Aseprite, Piskel, etc.): un `undo` revierte todo el trazo que acabas de pintar, no un pixel a la vez obligando a machacar Ctrl+Z decenas de veces para deshacer una sola pincelada. `TextureEditor` ya delimitaba naturalmente esta unidad desde el ticket 002 (pointer capture entre down y up/cancel) — este ticket solo le agrega dos callbacks nuevos (`onStrokeStart`/`onStrokeEnd`) sin tocar la lógica de pintado en sí.

### `PaintHistory` (`frontend/src/history.ts`): módulo puro separado de `TextureBuffer`

Igual que `TextureBuffer`/`colors.ts`, `history.ts` es una clase (`PaintHistory`) sin ninguna dependencia de React/DOM/three.js — testeable con Vitest en `environment: 'node'` (ver `frontend/test/history.spec.ts`). Decisión de diseño (el ticket no especificaba dónde debía vivir esta lógica): mantener el historial como módulo separado, no como un método/estado interno de `TextureBuffer`, para que `TextureBuffer` siga siendo exactamente lo que documenta el ticket 002 — "única interfaz de escritura sobre los pixeles", sin conocimiento de conceptos de UI/historial. `PaintHistory` no sabe pintar ni conoce el buffer: solo guarda pares `{before, after}` por pixel agrupados en "trazos" (`Stroke = PixelChange[]`), y es responsabilidad de quien la usa (`Editor.tsx`) leer el color "antes" del buffer al registrar un cambio, y escribirlo de vuelta al aplicar un undo/redo.

API: `beginStroke()` (pointerdown), `recordChange(x, y, before, after)` (cada escritura dentro del trazo en curso — si el mismo pixel se repinta más de una vez dentro del mismo trazo, ej. un arrastre que se autointersecta, conserva el `before` de la primera escritura y actualiza `after` a la última, para que deshacer el trazo completo devuelva el estado real anterior al trazo), `commitStroke()` (pointerup/pointercancel — apila el trazo en el historial de undo solo si tuvo al menos un cambio, y **descarta por completo el historial de redo** — criterio explícito del ticket 003: pintar algo nuevo tras un undo invalida los redos pendientes, no los deja acumulando ramas), `undo()`/`redo()` (devuelven el `Stroke` a aplicar, o `null` si no hay nada que deshacer/rehacer).

### Por qué `paintLine` en `Editor.tsx` no reutiliza el `painted` de `TextureBuffer.paintLine` para capturar el "antes"

`TextureBuffer.paintLine` devuelve las celdas efectivamente pintadas, pero no expone qué color tenía cada una ANTES de pintarla (no es su responsabilidad — sigue sin saber nada de historial). Para capturar el "antes" de cada pixel del trazo, el wrapper `paintLine` de `Editor.tsx` calcula sus propios `cells` con el mismo `bresenhamLine(...)` exportado y el mismo predicado `buffer.inBounds(...)` que usa `TextureBuffer.setPixel` internamente — **antes** de llamar a `buffer.paintLine(...)`, lee `buffer.getPixel(...)` de cada celda. Como ambos (`cells` en `Editor.tsx` y el `painted` que devuelve `buffer.paintLine`) se derivan de llamar exactamente a la misma función `bresenhamLine` con los mismos argumentos y filtrar con el mismo predicado `inBounds`, quedan garantizados idénticos en orden y contenido — no es una suposición frágil, es una identidad formal. Se descartó modificar `TextureBuffer.paintLine` para que devuelva también los "antes" (rompería su pureza respecto a conceptos de historial) y se descartó reimplementar el bucle de pintado completo dentro de `Editor.tsx` en vez de llamar a `buffer.paintLine` (dejaría el método público `paintLine` de `TextureBuffer` sin ningún consumidor real, pese a seguir siendo la interfaz documentada para futuras fuentes de escritura — HU-12).

### UI: `HistoryControls` + atajos de teclado a nivel de `window`

`frontend/src/components/HistoryControls.tsx` — dos `<button>` con texto visible ("Deshacer"/"Rehacer", no solo íconos, así que no requieren `aria-label` adicional por la regla de accesibilidad del equipo — aun así llevan `title` con el atajo equivalente), deshabilitados vía `disabled={!canUndo}`/`disabled={!canRedo}`.

Atajos de teclado (Ctrl/Cmd+Z deshacer; Ctrl/Cmd+Shift+Z o Ctrl+Y rehacer) se manejan con un listener de `keydown` a nivel de `window` en `Editor.tsx` (no en `TextureEditor` ni en `HistoryControls`), para que funcionen con el foco en cualquier parte de la página, tal como pedía el ticket. Verificado en vivo (Claude in Chrome) que el `<input type="color">` de `ColorPicker` no interfiere con estos atajos — no hizo falta ningún caso especial para él.

### `historyTick`: por qué existe un segundo contador además de `version`

`PaintHistory` es un objeto mutable igual que `TextureBuffer` (mismo patrón ya establecido en el ticket 002 con `version` para `buffer`) — React no vuelve a renderizar solo porque `history.canUndo`/`history.canRedo` cambiaron internamente. Se agregó un segundo contador de estado, `historyTick` (cuyo valor nunca se lee, solo se incrementa), separado de `version`: `version` sigue significando específicamente "el contenido de pixeles del buffer cambió" (dispara el redibujado del canvas 2D y `texture.needsUpdate` de three.js), mientras que `historyTick` solo fuerza el re-render de los botones de `HistoryControls` cuando cambia `canUndo`/`canRedo` sin que necesariamente haya cambiado el contenido pintado en ese mismo instante (ej. `commitStroke()` de un trazo vacío no cambiaría pixeles pero si podría cambiar `canRedo` de `true` a `false`). Mezclarlos en un solo contador habría acoplado dos significados distintos a la misma variable.

## Ticket 004 — Simetria de pintura + zoom/grid ajustable

100% cliente, sin cambios de API/backend (ver `docs/definiciones/editor-3d-texturas-esqueleto.md`, HU-6/HU-7).

### Simetria: un unico eje (horizontal), dentro de la caja UV completa de cada parte -- no por cara, no entre armRight/armLeft

El ticket dejaba a criterio de este ticket exactamente que eje(s) ofrecer. Decision, con la justificacion numerica completa en los comentarios de `frontend/src/symmetry.ts`:

- **La "caja UV" de simetria es el rectangulo "cross" completo de cada parte** (las 6 caras -- top/bottom/front/back/left/right -- tal como las desenrolla `applyBoxUV.ts`), no solo la cara frontal. Para el Esqueleto (formato clasico 64x32) hay 4 cajas UV *distintas* en pixeles de textura: cabeza `(0,0)-(32,16)`, torso `(16,16)-(40,32)`, brazo `(40,16)-(56,32)` y pierna `(0,16)-(16,32)`. `armRight`/`armLeft` (y `legRight`/`legLeft`) apuntan al MISMO origen UV -- `computeUVBoxRects` deriva estas cajas directamente de la geometria servida por el backend (fuente de verdad, no hardcodeada en el frontend) y deduplica los rectangulos identicos, quedando exactamente 4.
- **Se ofrece un unico eje: espejo horizontal** (refleja la columna `x` alrededor del centro vertical de la caja, misma fila `y`) -- no un selector horizontal/vertical. Motivo (derivado caja por caja, no una preferencia arbitraria): un espejo horizontal siempre es una biyeccion perfectamente definida sobre el ancho total de la caja (`2*d + 2*w`), sin importar los valores de profundidad (`d`) y alto (`h`) de la caja -- funciona para las 4 cajas por igual. Un espejo vertical, en cambio, solo produce un mapeo geometricamente coherente cuando `d == h` (la franja superior del "cross", de alto `d`, tiene que coincidir en tamaño con la franja inferior, de alto `h`): eso solo se cumple para la cabeza (cubo, `d=h=8`). Para torso/brazo/pierna (`d=4`, `h=12`) un espejo vertical mezclaria una franja de 4px con una de 12px sin correspondencia 1:1 real -- se descarto por producir resultados sin sentido en 3 de las 4 cajas.
- **Caveat documentado, no un bug:** dentro del "cross" unwrap, el espejo horizontal no siempre alinea exactamente "cara frontal con cara frontal" -- para cabeza/brazo/pierna (`d == w` en las 3), si alinea limpio (front↔back, right↔left, top↔bottom). Para el **torso** (`d=4`, `w=8`, `d != w`), el espejo cruza parcialmente la cara lateral (`right`, ancho `d`) con la cara trasera (`back`, ancho `w`) en vez de alinear right↔left exactamente. Es una simplificacion aceptada para el MVP (el ticket pedia "espejo dentro de la propia region", no precision por-cara) -- una version futura que quiera espejo por-cara exacto (ej. solo la cara frontal del torso) necesitaria una tabla de sub-rectangulos por cara, fuera de alcance de este ticket.
- **`armRight`/`armLeft` y `legRight`/`legLeft` no se mapean entre si** (instruccion explicita del ticket): como comparten el mismo rectangulo UV, pintar en esa region ya afecta a ambos lados 3D simultaneamente via el `mirrorX` de renderizado existente desde el ticket 001 -- construir ademas una regla de simetria que "mapee" entre ellos seria logica redundante y further confuso (dos mecanismos de mirror distintos pisandose).
- **Integracion con el historial (ticket 003):** un trazo simetrico sigue siendo una unica unidad de undo/redo. `Editor.tsx` ya no llama a `buffer.setPixel`/`buffer.paintLine` directo -- unifica ambos casos (click y arrastre) en `applyPixelsWithSymmetry`, que: (1) junta todos los puntos a escribir (primarios + sus espejos, deduplicados -- un punto puede coincidir con su propio espejo en la columna central, o el espejo de un punto puede coincidir con OTRO punto primario de la misma linea de arrastre), (2) lee el color "antes" de TODOS antes de escribir ninguno (evita capturar un "antes" ya contaminado por otra escritura del mismo evento), (3) recien entonces escribe y registra cada cambio en `history.recordChange`. Esto reemplaza la llamada a `TextureBuffer.paintLine` que usaba el ticket 003 -- ese metodo sigue existiendo y documentado como interfaz publica para HU-12, solo que `Editor.tsx` ya no es quien lo invoca (necesita la lectura de "antes" desacoplada de la escritura, que `paintLine` no expone).

### Zoom: factor variable (reemplaza el `DISPLAY_SCALE` fijo del ticket 002), Ctrl/Cmd + rueda como modificador elegido

- `frontend/src/zoom.ts`: `ZOOM_MIN=4` (400%), `ZOOM_MAX=40` (4000%), `ZOOM_STEP=2`, `ZOOM_DEFAULT=10` (1000% -- igual al `DISPLAY_SCALE` fijo que tenia el ticket 002, para no cambiar la apariencia por default al abrir el editor). El porcentaje mostrado en `ZoomControls` usa la convencion estandar de editores de imagen: 100% = 1 pixel CSS por texel.
- Mecanismo de zoom elegido: **botones +/- Y Ctrl/Cmd + rueda del mouse sobre el canvas** (el ticket dejaba "tu eleccion" entre botones y/o rueda -- se implementaron ambos). El modificador Ctrl/Cmd es deliberado: sin el, la rueda sobre el canvas competiria con el scroll normal del panel lateral (`overflowY: auto` en el `<aside>`); con el modificador, tambien se evita el zoom nativo de pagina que el navegador dispara por default con Ctrl+rueda (`e.preventDefault()` en el handler).
- **Pixel-perfect en cualquier zoom:** el backing store del `<canvas>` de textura sigue siendo exactamente `buffer.width x buffer.height` (resolucion nativa, 64x32) en todos los niveles de zoom -- solo cambia el `style.width`/`style.height` (CSS) que lo escala, con `image-rendering: pixelated` siempre activo (mismo mecanismo del ticket 002, ahora con el factor de escala como variable en vez de constante). Verificado en vivo (Claude in Chrome) a 3600%/3800% de zoom: bordes de pixel nitidos, sin gradientes/blur.

### Grid ajustable: mostrar/ocultar (checkbox), no opacidad/grosor -- y por que necesita un SEGUNDO canvas

- El ticket permitia elegir entre "mostrar/ocultar" o "ajustar opacidad/grosor" -- se implemento un checkbox simple (`GridToggle`, default activado) que muestra/oculta lineas de 1px entre texeles. No se agrego ademas un control de opacidad/grosor: el ticket solo pedia una de las dos alternativas, y un segundo control redundante hubiera sido over-engineering para el alcance de este ticket.
- **Antes de este ticket no existian lineas de grid reales** -- el "aspecto de cuadricula" del ticket 002 era puramente el efecto visual de los bloques de color de `image-rendering: pixelated`, sin ninguna linea trazada entre celdas. Este ticket agrega lineas reales.
- **Por que un segundo `<canvas>` superpuesto (`gridCanvasRef`) y no dibujar las lineas en el mismo canvas que la textura:** el canvas de textura tiene backing store de 64x32 -- un pixel de canvas es exactamente un texel, sin espacio "entre" pixeles donde trazar una linea sin corromper el color real de ese texel. El canvas de grid, en cambio, tiene backing store igual a la resolucion de PRESENTACION (`buffer.width*zoom x buffer.height*zoom`) y dibuja lineas de 1px en cada limite de texel -- se recalcula solo cuando cambia `zoom`/dimensiones/visibilidad (no en cada pixel pintado, `version` no esta en sus dependencias, para no repintar el grid en cada trazo). Tiene `pointer-events: none` y `aria-hidden="true"` -- decorativo, todos los eventos de puntero siguen llegando al canvas de textura de abajo.
- **El borde del editor se movio del `<canvas>` al `<div>` contenedor:** si el borde (1px) siguiera en el canvas de textura, su "content box" (donde se dibujan los pixeles) quedaria desplazado 1px respecto al canvas de grid superpuesto (que no tiene borde propio), desalineando visualmente las lineas de cuadricula respecto a los texeles reales. Se detecto este riesgo durante el diseño (no en QA en vivo) y se resolvio antes de implementar, no como parche posterior.
