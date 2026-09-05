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

### Pendiente de verificar antes de que el CI real corra en verde (no bloqueante para abrir el PR, sí para el merge)

- **Registro de este proyecto en SonarQube** (`sonar.projectKey=texture-studio-mc`, servidor `sonarqube-vm`, webhook Sonar→Jenkins): el `Jenkinsfile` invoca `withSonarQubeEnv('sonarqube-vm')` + `waitForQualityGate abortPipeline: true` asumiendo que el proyecto ya está dado de alta (como indica la descripción del skill `bootstrap-proyecto`) — no se encontró en este repo evidencia directa (archivo de config, ticket cerrado) de que ese paso ya se ejecutó para `texture-studio-mc` específicamente. Si no está registrado/con el webhook conectado, el stage "Quality Gate de SonarQube" se cuelga hasta el timeout (5 min) en vez de fallar rápido. Confirmar con Marco/DevOps antes del primer build real en Jenkins.
- **Volumen de `vanilla-assets/`**: este ticket define el path de contenedor (`/app/vanilla-assets`) pero no agrega el volumen de host a `deploy/docker-compose.*.yml` — eso es alcance explícito del ticket 007. Hasta que corra ese ticket, todos los ambientes sirven el placeholder (comportamiento esperado, no un bug).
