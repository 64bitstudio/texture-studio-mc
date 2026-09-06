# API — Texture Studio MC

El backend es deliberadamente mínimo (sin lógica de negocio real — toda la edición/exportación de los tickets 002-006 ocurre en el navegador). Sin autenticación, sin persistencia server-side.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Healthcheck para `corePipeline` (Jenkins) y Traefik. |
| `GET` | `/api/mobs` | Catálogo de mobs soportados (ticket 016), para el selector de mob del frontend (ticket 018). |
| `GET` | `/api/base-assets/:mobId` | Textura vanilla base (real o placeholder) + definición de geometría/UV del mob solicitado. `404` si `mobId` no existe en el registro. |
| `GET` | `/*` | Sirve el build estático de la SPA (frontend). |

## `GET /health`

Respuesta `200`:

```json
{ "status": "ok" }
```

Sin dependencias externas (no hay DB/cache en este proyecto) — un `200` certifica que el proceso Node está arriba y sirviendo requests.

## `GET /api/mobs`

Nuevo en el ticket 016. Catálogo de los mobs soportados por el backend (`MOB_REGISTRY`), para que el frontend arme el menú de selección (ticket 018). No incluye geometría ni ningún otro detalle interno — solo lo que el menú necesita.

Respuesta `200`:

```jsonc
{
  "mobs": [
    { "id": "skeleton", "label": "Esqueleto" },
    { "id": "zombie", "label": "Zombie" },
    { "id": "spider", "label": "Araña" } // ticket 020
    // Creeper se agrega en su propio ticket (021).
  ]
}
```

## `GET /api/base-assets/:mobId`

Generaliza el endpoint literal `GET /api/base-assets/skeleton` del ticket 001 (ticket 016) — ver `docs/ARQUITECTURA.md` ("Contrato de `GET /api/base-assets/:mobId`") para la decisión de diseño. `mobId` es cualquier `id` del catálogo de `GET /api/mobs` (`"skeleton"`, `"zombie"` o `"spider"` por ahora).

> **Ticket 020 — ensanchamiento de contrato (aditivo, no rompe compatibilidad con Esqueleto/Zombie):** `geometry.parts` deja de ser un objeto con exactamente las 6 claves `head`/`body`/`armRight`/`armLeft`/`legRight`/`legLeft` y pasa a ser un diccionario de nombre-de-parte → caja de **tamaño arbitrario**, necesario para dar cabida a la Araña (cabeza+tórax+abdomen+8 patas, sin brazos). Esqueleto y Zombie siguen devolviendo exactamente las mismas 6 claves de siempre, sin ningún cambio. Cada caja también puede traer un campo nuevo opcional `group` (mismo criterio que `mirrorX`/`faceLabels`: úsalo para saber qué partes comparten la misma región UV — ver el ejemplo de la Araña más abajo, donde las 8 patas comparten `group: "spiderLeg"`). Ver `docs/ARQUITECTURA.md`, "Ticket 020", para la justificación completa.

Respuesta `404` si `mobId` no existe en el registro:

```jsonc
{ "error": "El mob \"mob-inexistente\" no existe. Ver GET /api/mobs para el catalogo disponible." }
```

Respuesta `200` (idéntica en forma y valores a la que ya existía para `/api/base-assets/skeleton` antes del ticket 016 — sin cambio de contrato):

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
      "head":     { "size": [8, 8, 8],   "position": [0, 28, 0], "uv": { "x": 0,  "y": 0 },  "faceLabels": { "front": "Cara", "back": "Nuca", "top": "Parte superior", "bottom": "Parte inferior", "left": "Lateral derecho", "right": "Lateral izquierdo" } },
      "body":     { "size": [8, 12, 4],  "position": [0, 18, 0], "uv": { "x": 16, "y": 16 }, "faceLabels": { "front": "Pecho", "back": "Espalda", "top": "Parte superior", "bottom": "Parte inferior", "left": "Costado derecho", "right": "Costado izquierdo" } },
      "armRight": { "size": [2, 12, 2],  "position": [-5, 18, 0], "uv": { "x": 40, "y": 16 }, "faceLabels": { "front": "Brazo — Frente", "back": "Brazo — Atrás", "top": "Brazo — Superior", "bottom": "Brazo — Inferior", "left": "Brazo — Lateral", "right": "Brazo — Lateral" } },
      "armLeft":  { "size": [2, 12, 2],  "position": [5, 18, 0],  "uv": { "x": 40, "y": 16 }, "mirrorX": true, "faceLabels": { "front": "Brazo — Frente", "back": "Brazo — Atrás", "top": "Brazo — Superior", "bottom": "Brazo — Inferior", "left": "Brazo — Lateral", "right": "Brazo — Lateral" } },
      "legRight": { "size": [2, 12, 2],  "position": [-2, 6, 0],  "uv": { "x": 0,  "y": 16 }, "faceLabels": { "front": "Pierna — Frente", "back": "Pierna — Atrás", "top": "Pierna — Superior", "bottom": "Pierna — Inferior", "left": "Pierna — Lateral", "right": "Pierna — Lateral" } },
      "legLeft":  { "size": [2, 12, 2],  "position": [2, 6, 0],   "uv": { "x": 0,  "y": 16 }, "mirrorX": true, "faceLabels": { "front": "Pierna — Frente", "back": "Pierna — Atrás", "top": "Pierna — Superior", "bottom": "Pierna — Inferior", "left": "Pierna — Lateral", "right": "Pierna — Lateral" } }
    }
  }
}
```

- `size`: `[ancho(x), alto(y), profundidad(z)]` de la caja, en las mismas unidades que los pixeles de la textura (1 unidad de escena tres.js = 1 pixel de textura).
- `position`: centro de la caja, con el origen en el centro de los pies del modelo (`y=0`) — convención `+x` = derecha de pantalla, `+y` = arriba, `+z` = hacia la cámara (frente del personaje).
- `uv`: origen (esquina superior izquierda) del "cross" UV clásico de esa caja, en pixeles de textura (0,0 = esquina superior izquierda de la textura).
- `mirrorX`: `true` en `armLeft`/`legLeft` — el formato legado 64×32 no tiene región UV propia para el lado izquierdo, así que reutiliza la de `armRight`/`legRight` reflejada horizontalmente (ver `frontend/src/geometry/applyBoxUV.ts` y `docs/ARQUITECTURA.md`).
- **Ticket 009**: `armRight`/`armLeft`/`legRight`/`legLeft` se corrigieron de `size [4,12,4]` (proporción genérica de Steve/zombie) a `[2,12,2]` (huesos delgados del Esqueleto real); `armRight.position.x`/`armLeft.position.x` de `∓6` a `∓5`. Sin cambio de forma/contrato del endpoint — mismos campos, valores corregidos. Ver `docs/ARQUITECTURA.md`, "Ticket 009", para las fuentes de verificación.
- **Ticket 011** (aditivo, no rompe compatibilidad): cada caja de `geometry.parts.*` gana un campo nuevo `faceLabels` — nombre legible (es-MX) de cada una de sus 6 caras (`front`/`back`/`top`/`bottom`/`left`/`right`). Ver `docs/ARQUITECTURA.md`, "Ticket 011", para el catálogo completo y las decisiones de diseño (convención `left`/`right` anatómica, no de pantalla; `armRight`/`armLeft`/`legRight`/`legLeft` con labels sin lateralidad).

Nunca responde `5xx` por falta del asset vanilla real — cae automáticamente al placeholder (ver `docs/ARQUITECTURA.md`).

### `GET /api/base-assets/zombie` (ticket 017)

Misma forma de respuesta que arriba, pero con las 6 cajas del Zombie (verificadas contra `bedrock-samples` + el asset vanilla real — ver `docs/ARQUITECTURA.md`, "Ticket 017"). Dos diferencias reales respecto al Esqueleto, ninguna de forma/contrato:

- `texture.width`/`texture.height` y `geometry.textureWidth`/`textureHeight` son **64×64** (no 64×32) — el `zombie.png` vanilla real es 64×64, con la mitad inferior (filas 32-63) completamente vacía/transparente (no usa overlays de sleeve/pants; confirmado empíricamente pixel a pixel).
- `armRight`/`armLeft`/`legRight`/`legLeft` usan `size [4,12,4]` (brazos/piernas gruesos, tipo Steve) en vez de `[2,12,2]`; sus `position` NO son las mismas que las del Esqueleto reescaladas (`armRight.position.x = -6`, no `-5`; `legRight.position.x = -1.9`, no `-2` — offset asimétrico ya presente en la fuente oficial de Mojang, ver `docs/ARQUITECTURA.md`).

```jsonc
{
  "texture": { "dataUrl": "data:image/png;base64,....", "width": 64, "height": 64, "isPlaceholder": false },
  "geometry": {
    "textureWidth": 64,
    "textureHeight": 64,
    "parts": {
      "head":     { "size": [8, 8, 8],   "position": [0, 28, 0],    "uv": { "x": 0,  "y": 0 } },
      "body":     { "size": [8, 12, 4],  "position": [0, 18, 0],    "uv": { "x": 16, "y": 16 } },
      "armRight": { "size": [4, 12, 4],  "position": [-6, 18, 0],   "uv": { "x": 40, "y": 16 } },
      "armLeft":  { "size": [4, 12, 4],  "position": [6, 18, 0],    "uv": { "x": 40, "y": 16 }, "mirrorX": true },
      "legRight": { "size": [4, 12, 4],  "position": [-1.9, 6, 0],  "uv": { "x": 0,  "y": 16 } },
      "legLeft":  { "size": [4, 12, 4],  "position": [1.9, 6, 0],   "uv": { "x": 0,  "y": 16 }, "mirrorX": true }
    }
  }
}
```

(`faceLabels` de cada caja omitidos arriba por brevedad — mismo catálogo exacto que el Esqueleto, ver `backend/src/geometry/zombieGeometry.ts`.)

### `GET /api/base-assets/spider` (ticket 020)

Primera anatomía NO-biped del catálogo: 3 cajas de cuerpo (`head`, `thorax`, `abdomen` — sin `body` genérico ni brazos) + 8 patas, todas compartiendo `size`/`uv` (y por eso el mismo `group`). Verificado contra `bedrock-samples` + el asset vanilla real — ver `docs/ARQUITECTURA.md`, "Ticket 020".

```jsonc
{
  "texture": { "dataUrl": "data:image/png;base64,....", "width": 64, "height": 32, "isPlaceholder": false },
  "geometry": {
    "textureWidth": 64,
    "textureHeight": 32,
    "parts": {
      "head":      { "size": [8, 8, 8],    "position": [0, 9, -7], "uv": { "x": 32, "y": 4 } },
      "thorax":    { "size": [6, 6, 6],    "position": [0, 9, 0],  "uv": { "x": 0,  "y": 0 } },
      "abdomen":   { "size": [10, 8, 12],  "position": [0, 9, 9],  "uv": { "x": 0,  "y": 12 } },
      "leg1Right": { "size": [16, 2, 2],   "position": [-11, 9, -1], "uv": { "x": 18, "y": 0 }, "group": "spiderLeg" },
      "leg1Left":  { "size": [16, 2, 2],   "position": [11, 9, -1],  "uv": { "x": 18, "y": 0 }, "mirrorX": true, "group": "spiderLeg" }
      // leg2Right/Left .. leg4Right/Left: mismo size/uv/group, solo cambia `position.z` (ver spiderGeometry.ts).
    }
  }
}
```

- Ningún campo `body`/`armRight`/`armLeft`/`legRight`/`legLeft` — anatomía distinta, ver el ensanchamiento de contrato arriba.
- Las 8 patas comparten `group: "spiderLeg"`: pintar la región UV de una pata en el editor pinta las 8 a la vez (mismo comportamiento que `armRight`/`armLeft` en el biped, solo que con 8 partes en vez de 2 compartiendo el grupo).
- `faceLabels` de cada caja (omitidos arriba por brevedad): prefijados por parte (`"Tórax — Frente"`, `"Abdomen — Frente"`, `"Pata — Frente"`, sin lateralidad en las patas) para que el selector "Aislar parte" no muestre dos regiones distintas con el mismo nombre "Frente" — ver `backend/src/geometry/spiderGeometry.ts`.

## `GET /*` (catch-all SPA)

Sirve `index.html` del build del frontend para cualquier ruta no reconocida arriba (necesario para el enrutamiento client-side de React, aunque el MVP de este ticket todavía no tiene rutas propias). En dev local (`npm run dev` de Vite aparte) esta ruta del backend normalmente no se usa — ver `docs/README.md`.
