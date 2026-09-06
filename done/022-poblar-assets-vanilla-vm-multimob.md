# 022 — Poblar assets vanilla reales de Zombie/Araña/Creeper en la VM

## Objetivo
Sale de `docs/definiciones/multi-mob-y-proyectos-guardados.md`. Mismo mecanismo ya usado para el Esqueleto (ticket 007), generalizado a los mobs nuevos ya integrados (tickets 017/020/021).

## Depende de
Tickets 017 (Zombie), 020 (Araña) y 021 (Creeper) ya cerrados — este ticket solo despliega, no investiga geometría.

## Alcance
- Copiar `zombie.png`, `spider.png`, `creeper.png` desde `~/tools/minecraft-texture-pack/vanilla-cache/` al mismo directorio compartido ya usado en la VM (`/home/ubuntu/vanilla-assets/texture-studio-mc/`) — el volumen de host ya montado desde el ticket 007 cubre CUALQUIER archivo en ese directorio, no hace falta tocar `docker-compose.*.yml`.
- Verificar permisos (`chown ubuntu:ubuntu`, `chmod 644`) igual que el Esqueleto.
- Desplegar y verificar en DEV que los 4 mobs (`GET /api/base-assets/skeleton|zombie|spider|creeper`) responden `isPlaceholder: false`.

## Criterios de aceptación
- Dado cada uno de los 4 mobs en DEV, cuando se consulta su endpoint, entonces `isPlaceholder` es `false` y el visor 3D muestra la textura vanilla real (no el placeholder gris).

## Hecho

Puramente despliegue de infraestructura, sin cambios de código -- mismo mecanismo del ticket 007.

- `zombie.png`, `spider.png`, `creeper.png` copiados desde `~/tools/minecraft-texture-pack/vanilla-cache/` a `/home/ubuntu/vanilla-assets/texture-studio-mc/` en la VM (`scp` vía el alias SSH `ampere-free`).
- Permisos ajustados: `chown ubuntu:ubuntu`, `chmod 644` (igual que el Esqueleto).
- No fue necesario tocar `docker-compose.*.yml` -- el volumen de host ya montado desde el ticket 007 cubre cualquier archivo nuevo en ese directorio (bind mount, cambios visibles de inmediato sin redeploy).
- Ver `docs/ARQUITECTURA.md`, "Ticket 022".

**Verificación en vivo (DEV real, inmediatamente después de copiar los archivos, sin redeploy)**:
- `GET /api/base-assets/skeleton|zombie|spider|creeper` → los 4 responden `isPlaceholder: false`.
- Visor 3D de los 4 mobs confirmado visualmente con su textura vanilla real correctamente aplicada: Esqueleto (huesos visibles), Zombie (piel verde + ropa característica), Araña (ojos rojos, camuflaje marrón), Creeper (camuflaje verde, cara fruncida icónica).

Con esto, los 4 mobs del backlog `docs/definiciones/multi-mob-y-proyectos-guardados.md` quedan completos de punta a punta (geometría + textura real + guardado de proyectos) en DEV.
