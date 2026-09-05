# Componentes — Texture Studio MC

## Frontend (`frontend/src/`)

Construidos en este ticket (001):

- **`App.tsx`** — orquesta el fetch de `GET /api/base-assets/skeleton` (estados `loading`/`error`/`ready`, con reintento) y renderiza `Viewer3D` cuando el asset base está listo. Muestra un badge cuando la textura servida es el placeholder (`texture.isPlaceholder`).
- **`components/Viewer3D.tsx`** — visor 3D del modelo (`@react-three/fiber` + `drei`):
  - `Viewer3D`: `<Canvas>` con fondo sólido explícito (ver `docs/ARQUITECTURA.md`, "canvas transparente por default") y `OrbitControls` (orbit/zoom/pan).
  - `SkeletonModel`: carga la textura (`useLoader(THREE.TextureLoader, ...)` sobre el `dataUrl` del backend), configura `magFilter`/`minFilter = NearestFilter` y `generateMipmaps = false` (pixel-art nítido, sin blur), y arma un `MeshBasicMaterial` (sin luces — la meta es previsualizar la textura tal cual, sin sombreado, clave para el editor de pixeles de los tickets siguientes).
  - `SkeletonPartMesh`: una caja (`THREE.BoxGeometry`) por parte del modelo, con el UV clásico aplicado vía `applyBoxUV`.
- **`geometry/applyBoxUV.ts`** — aplica el mapeo UV "cross" clásico de Minecraft sobre un `BoxGeometry`, incluyendo el `mirrorX` de brazo/pierna izquierdo. Ver `docs/ARQUITECTURA.md` para la derivación completa.
- **`api/baseAssets.ts`** — cliente `fetch` de `GET /api/base-assets/skeleton`.
- **`types/baseAssets.ts`** — espejo TypeScript del contrato del backend (ver `docs/API.md`; duplicación deliberada, sin paquete compartido en este ticket).

Pendiente de tickets futuros (fuera de alcance de este ticket, no implementado):

- **`TextureEditor`** — cuadrícula 64×32 (`<canvas>` 2D) donde se pinta pixel a pixel; zoom/grid ajustable; modo brocha (drag) — ticket 002.
- **`ColorPicker`** — selector de color libre (hex/RGB) + paleta predefinida "estilo Minecraft" — ticket 002.
- **`ToolsPanel`** — undo/redo (003), toggle de simetría + eje (004), importar textura existente + pegar/ajustar imagen a una región UV (005).
- **`ExportBar`** — botones "Exportar PNG" y "Exportar pack (.zip)" — ticket 006.
- **`TextureBuffer`** (no visual, estado compartido) — `ImageData` de 64×32, única interfaz de escritura para pincel/importar/pegar/futura IA (ver definición, HU-12) — ticket 002+.

## Backend (`backend/src/`)

- **`app.ts`** — crea y configura la app Express (sin auth, sin lógica de negocio): monta `healthRouter` y `baseAssetsRouter`, sirve el build estático del frontend (`FRONTEND_DIST_DIR`, default `./public`) y un catch-all que devuelve `index.html` para rutas no reconocidas.
- **`server.ts`** — entrypoint: llama a `createApp()` y escucha en `PORT` (default `3000`).
- **`routes/health.ts`** — `GET /health`.
- **`routes/baseAssets.ts`** — `GET /api/base-assets/skeleton`: combina `SKELETON_GEOMETRY` (fuente de verdad de geometría/UV) con la textura cargada por `loadSkeletonTexture()`.
- **`geometry/skeletonGeometry.ts`** — definición de las 6 cajas del modelo (tamaño/posición/UV/`mirrorX`), calibrada contra `~/tools/minecraft-texture-pack/mc_render_preview.py` (ver `docs/ARQUITECTURA.md`).
- **`services/skeletonTexture.ts`** — carga `vanilla-assets/skeleton.png` si existe; si no (o falla la lectura por cualquier motivo), cae al placeholder — nunca lanza.
- **`services/placeholderTexture.ts`** — genera el PNG placeholder 64×32 100% procedural (`pngjs`, sin dependencias nativas).
- **`types/baseAssets.ts`** — tipos del contrato de `GET /api/base-assets/skeleton` (ver `docs/API.md`).

## Tests (`backend/test/`)

- **`health.spec.ts`** — `GET /health` responde `200` con `{"status":"ok"}`.
- **`baseAssets.spec.ts`** — `GET /api/base-assets/skeleton` responde `200` con placeholder + geometría cuando el asset real no existe (fuerza `VANILLA_ASSETS_DIR` a un directorio inexistente); nunca responde `5xx` por esta causa.

El frontend todavía no tiene tests unitarios propios (fuera de alcance de este ticket) — la validación disponible es `npm run lint` + `npm run build` (ver `docs/README.md`).
