# API — Texture Studio MC

El backend es deliberadamente mínimo (sin lógica de negocio real — toda la edición/exportación ocurre en el navegador). Endpoints previstos:

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Healthcheck para `corePipeline` (Jenkins) y Traefik. |
| `GET` | `/api/base-assets/skeleton` | Sirve la textura vanilla base + definición de geometría/UV del Esqueleto, desde el volumen no versionado (ver `docs/ARQUITECTURA.md`). |
| `GET` | `/*` | Sirve el build estático de la SPA (frontend). |

Se completa/ajusta este archivo conforme se implemente el ticket real del backend.
