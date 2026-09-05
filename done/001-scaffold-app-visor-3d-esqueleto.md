# 001 — Scaffold de la app + Visor 3D del Esqueleto vanilla

## Objetivo
Sale de `docs/definiciones/editor-3d-texturas-esqueleto.md` (HU-1, Diseño técnico). Levantar el scaffold real de frontend (React+Vite+TypeScript) y backend (Node.js mínimo), y construir el visor 3D que carga el modelo vanilla del Esqueleto (geometría por cajas, UV clásico 64×32) con su textura base y controles de cámara.

## Alcance
- Frontend: proyecto Vite+React+TypeScript, `@react-three/fiber` + `drei`.
- Geometría del Esqueleto por cajas (head/body/arm/leg) con las coordenadas UV de `docs/definiciones/editor-3d-texturas-esqueleto.md` (sección "Diseño técnico").
- Backend mínimo: sirve el build estático + endpoint `GET /api/base-assets/skeleton` (textura + geometría) desde un directorio no versionado (placeholder de textura mientras Marco puebla el asset real, ver ticket 007) + `GET /health`.
- No incluye: editor de textura (ticket 002), export (ticket 006).

## Criterios de aceptación (HU-1)
- Dado que abro la app, cuando la página carga, entonces veo el modelo 3D del Esqueleto con textura (real o placeholder) en pose estática.
- Dado el visor 3D, cuando arrastro/hago scroll, entonces puedo rotar/zoom/desplazar la cámara.

## Hecho
Implementado por el agente `fullstack-dev` (PR [#2](https://github.com/64bitstudio/texture-studio-mc/pull/2)) + bootstrap manual de VM/DNS del orquestador (PR [#3](https://github.com/64bitstudio/texture-studio-mc/pull/3)). Ambos PRs con CI de Jenkins en verde (build+test+Sonar+Quality Gate OK) y sin hallazgos de los gates de QA automático (`🔍 QA Review (auto)` sin hallazgos en ambos).

- Scaffold real: `frontend/` (Vite+React+TS, `@react-three/fiber`/`drei`) y `backend/` (Express+TS, tests con vitest+supertest, 91% cobertura).
- Geometría del Esqueleto (6 cajas, UV clásico 64×32) calibrada y verificada vértice-por-vértice contra `~/tools/minecraft-texture-pack/mc_render_preview.py`.
- `GET /health` y `GET /api/base-assets/skeleton` (textura + geometría, con fallback automático a placeholder procedural mientras no exista el asset vanilla real — ticket 007), documentado en `docs/API.md`.
- Infra de despliegue completa: `Dockerfile`, `deploy/docker-compose.{dev,qa,prod}.yml`, `deploy/cleanup.sh`, vhost de nginx, `Jenkinsfile` con `buildAndTest` real (Sonar) + deploy dev/qa/prod.
- Bootstrap manual de VM hecho por el orquestador (no cubierto por `sync-vm-infra` para un proyecto nuevo, ver `docs/ARQUITECTURA.md`): `/home/ubuntu/secrets/texture-studio-mc/.env.{dev,qa,prod}` (sin secretos reales) y los 3 registros DNS A en Cloudflare (con VoBo explícito de Marco antes de tocar el dominio compartido).
- **Verificado en vivo contra el deploy real de DEV** (no solo local): `https://texture-studio-dev.64bitstudio.com/health` → `200 {"status":"ok"}` con HTTPS real (certbot); `GET /api/base-assets/skeleton` devuelve las 6 partes de geometría + textura placeholder; revisión visual en Chrome confirma el modelo cargando correctamente y respondiendo a rotación (OrbitControls) — cumple los 2 criterios de aceptación de HU-1.
- Hallazgo real resuelto en el camino (no relacionado con el código en sí): el primer build de `dev` falló por dos huecos de bootstrap de proyecto nuevo — falta el archivo `.env` de secrets en la VM y falta el DNS de los 3 subdominios (`certbot` con `NXDOMAIN`). Ninguno de los dos está cubierto automáticamente por `sync-vm-infra` para un proyecto nuevo — documentado en `docs/ARQUITECTURA.md` para que el ticket 007 (u otro proyecto futuro) no repita el mismo diagnóstico desde cero.
- Pendiente, explícitamente fuera de este ticket: asset vanilla real (ticket 007), editor de textura (ticket 002+).
