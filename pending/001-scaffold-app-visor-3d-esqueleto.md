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
