# 016 — Backend: registro de mobs + API generalizada

## Objetivo
Sale de `docs/definiciones/multi-mob-y-proyectos-guardados.md` (Diseño técnico). Generaliza el backend de "un mob hardcodeado (Esqueleto)" a un registro de mobs, sin romper el comportamiento actual del Esqueleto.

## Alcance
- `backend/src/mobs/registry.ts` (nuevo): `MOB_REGISTRY: Record<MobId, MobDefinition>` — cada entrada con `id`, `label`, su geometría, y el nombre de archivo del asset vanilla (`<mobId>.png`).
- `MobId` inicial: solo `'skeleton'` (los demás se agregan en sus propios tickets 017/020/021) — el registro debe quedar diseñado para crecer sin refactor, no para tener ya los 4 mobs.
- Nuevo endpoint `GET /api/mobs` → catálogo `{ mobs: [{ id, label }] }`, para que el frontend arme el menú (ticket 018).
- Generaliza `GET /api/base-assets/skeleton` a `GET /api/base-assets/:mobId` — mismo contrato de respuesta que hoy (texture + geometry), 404 claro (`{ error: "..." }`) si `mobId` no existe en el registro.
- `loadSkeletonTexture` se generaliza a `loadMobTexture(mobId)` — misma lógica de fallback a placeholder si `vanilla-assets/<mobId>.png` no existe.
- Actualiza `postman/texture-studio-mc.postman_collection.json` con las nuevas rutas.
- Actualiza `docs/API.md`.

## Qué NO construir (fuera de este ticket)
- No agregues Zombie/Araña/Creeper al registro todavía — eso es ticket 017 (Zombie) y sus propios tickets para los demás.
- No toques el frontend — sigue consumiendo `/api/base-assets/skeleton` tal cual hasta el ticket 018 (puedes dejar temporalmente ambas rutas si simplifica la migración, pero documenta la decisión).

## Criterios de aceptación
- Dado `GET /api/mobs`, cuando se consulta, entonces devuelve al menos `{ id: "skeleton", label: "Esqueleto" }`.
- Dado `GET /api/base-assets/skeleton`, cuando se consulta, entonces el contrato de respuesta es idéntico al de antes de este ticket (sin romper nada ya construido).
- Dado `GET /api/base-assets/mob-inexistente`, cuando se consulta, entonces responde 404 con un mensaje claro.
