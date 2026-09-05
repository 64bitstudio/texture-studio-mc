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

### Escala de presentación fija (×10), sin controles de zoom

`TextureEditor` renderiza el `<canvas>` con backing store real de 64×32 (mismas dimensiones que el buffer, para que cada pixel del canvas sea exactamente un pixel de textura) y lo escala por CSS a 640×320 con `image-rendering: pixelated` (equivalente CSS de `imageSmoothingEnabled = false` para el escalado de *presentación* — el contexto 2D también fija `imageSmoothingEnabled = false` por si en el futuro se agrega algún `drawImage` escalado). El factor ×10 es una constante fija (`DISPLAY_SCALE`) — zoom/grid ajustable es alcance explícito del ticket 004, no se construyó ningún control de zoom aquí para no adelantarse a ese ticket.

### `Viewer3D`: cambio de contrato (ya no hace fetch/decode propio)

El ticket 001 le pasaba a `Viewer3D` la respuesta completa (`data: SkeletonBaseAssetsResponse`) y el propio componente decodificaba el `dataUrl` vía `useLoader(TextureLoader, ...)` + `Suspense`. Desde el ticket 002, `Viewer3D` recibe `texture: THREE.Texture` y `geometry: SkeletonGeometry` ya resueltos — la textura viene de `useCanvasTexture` en `Editor.tsx`, compartida con `TextureEditor` a través del mismo `TextureBuffer`. Es un cambio de contrato interno del frontend (no de la API HTTP, que no cambió) — documentado aquí porque un ticket futuro que reintroduzca `Viewer3D` en otro contexto (ej. previsualizar otro mob) debe seguir este mismo patrón en vez de volver a acoplar fetch+decode+render en un solo componente.
