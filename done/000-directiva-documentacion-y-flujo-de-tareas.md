# 000 — Directiva: documentación y flujo de tareas

## Objetivo
Dejar constancia de que este repo sigue la convención del equipo `/pending /in-process /done /docs` + `docs/definiciones/` (cambio grande, ya usada — ver `docs/definiciones/editor-3d-texturas-esqueleto.md`) + `/postman` (proyecto fullstack, expone un backend propio aunque mínimo).

## Reglas específicas de este repo
- Es un proyecto **fullstack** (frontend React+Vite+TypeScript con Three.js + backend Node.js mínimo) — no es un "core" reusable como `auth-core-mc`/`mail-core-mc`, pero sigue la misma anatomía de despliegue (Jenkinsfile + Shared Library de `platform`, Traefik, ramas `dev`/`qa`/`prod`).
- Toda decisión de alcance/diseño técnico ya definida vive en `docs/definiciones/editor-3d-texturas-esqueleto.md` (documento con VoBo explícito de Marco, 2026-09-05) — cualquier ticket que nazca de ahí debe referenciarlo en su sección `## Objetivo`.
- Sin autenticación ni persistencia server-side en el MVP (decisión explícita, ver definición) — no asumir que un ticket futuro los necesita sin confirmarlo primero.
- La textura vanilla real del Esqueleto (`skeleton.png`) nunca se versiona en este repo (asset de Mojang) — ver `docs/ARQUITECTURA.md`.

## Hecho
Bootstrap inicial del repo (2026-09-05): estructura de carpetas + esqueleto de `/docs` + `/postman` + este ticket + backlog inicial (tickets 001-008, ver `docs/definiciones/editor-3d-texturas-esqueleto.md`, sección "Impacto estimado").
