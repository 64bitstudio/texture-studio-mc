# API — Texture Studio MC

El backend es deliberadamente mínimo (sin lógica de negocio real — toda la edición/exportación de los tickets 002-006 ocurre en el navegador). Sin autenticación, sin persistencia server-side.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Healthcheck para `corePipeline` (Jenkins) y Traefik. |
| `GET` | `/api/base-assets/skeleton` | Textura vanilla base (real o placeholder) + definición de geometría/UV del Esqueleto. |
| `GET` | `/*` | Sirve el build estático de la SPA (frontend). |

## `GET /health`

Respuesta `200`:

```json
{ "status": "ok" }
```

Sin dependencias externas (no hay DB/cache en este proyecto) — un `200` certifica que el proceso Node está arriba y sirviendo requests.

## `GET /api/base-assets/skeleton`

Ver `docs/ARQUITECTURA.md` ("Contrato de `GET /api/base-assets/skeleton`") para la decisión de diseño de este endpoint.

Respuesta `200`:

```jsonc
{
  "texture": {
    "dataUrl": "data:image/png;base64,....",  // PNG 64x32, real o placeholder
    "width": 64,
    "height": 32,
    "isPlaceholder": true // true mientras vanilla-assets/skeleton.png no exista (ver ticket 007)
  },
  "geometry": {
    "textureWidth": 64,
    "textureHeight": 32,
    "parts": {
      "head":     { "size": [8, 8, 8],   "position": [0, 28, 0], "uv": { "x": 0,  "y": 0 } },
      "body":     { "size": [8, 12, 4],  "position": [0, 18, 0], "uv": { "x": 16, "y": 16 } },
      "armRight": { "size": [4, 12, 4],  "position": [-6, 18, 0], "uv": { "x": 40, "y": 16 } },
      "armLeft":  { "size": [4, 12, 4],  "position": [6, 18, 0],  "uv": { "x": 40, "y": 16 }, "mirrorX": true },
      "legRight": { "size": [4, 12, 4],  "position": [-2, 6, 0],  "uv": { "x": 0,  "y": 16 } },
      "legLeft":  { "size": [4, 12, 4],  "position": [2, 6, 0],   "uv": { "x": 0,  "y": 16 }, "mirrorX": true }
    }
  }
}
```

- `size`: `[ancho(x), alto(y), profundidad(z)]` de la caja, en las mismas unidades que los pixeles de la textura (1 unidad de escena tres.js = 1 pixel de textura).
- `position`: centro de la caja, con el origen en el centro de los pies del modelo (`y=0`) — convención `+x` = derecha de pantalla, `+y` = arriba, `+z` = hacia la cámara (frente del personaje).
- `uv`: origen (esquina superior izquierda) del "cross" UV clásico de esa caja, en pixeles de textura (0,0 = esquina superior izquierda de la textura).
- `mirrorX`: `true` en `armLeft`/`legLeft` — el formato legado 64×32 no tiene región UV propia para el lado izquierdo, así que reutiliza la de `armRight`/`legRight` reflejada horizontalmente (ver `frontend/src/geometry/applyBoxUV.ts` y `docs/ARQUITECTURA.md`).

Nunca responde `5xx` por falta del asset vanilla real — cae automáticamente al placeholder (ver `docs/ARQUITECTURA.md`).

## `GET /*` (catch-all SPA)

Sirve `index.html` del build del frontend para cualquier ruta no reconocida arriba (necesario para el enrutamiento client-side de React, aunque el MVP de este ticket todavía no tiene rutas propias). En dev local (`npm run dev` de Vite aparte) esta ruta del backend normalmente no se usa — ver `docs/README.md`.
