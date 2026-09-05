# Arquitectura — Texture Studio MC

Ver `docs/definiciones/editor-3d-texturas-esqueleto.md` (documento de definición con VoBo) para el diseño técnico completo y los diagramas. Este archivo se amplía conforme el desarrollo real avance y se tomen decisiones que no estaban en la definición original.

## Resumen

- Toda la edición (pintar pixel a pixel) y toda la exportación (PNG y ZIP) ocurren **100% en el navegador** — sin round-trip al backend.
- El backend es deliberadamente mínimo: sirve el build estático del frontend y el asset vanilla base (geometría + textura del Esqueleto).
- **La textura vanilla real (`skeleton.png`) NO vive en este repo** — es un asset de Mojang. Se sirve desde un directorio fuera de git, poblado por Marco a partir de un client `.jar` legítimamente instalado (mismo mecanismo que `~/tools/minecraft-texture-pack/vanilla-cache/` del pipeline hermano `minecraft-texture-pack-pipeline`). La geometría/UV del modelo (coordenadas de las cajas) sí se versiona — es información pública del formato, no un asset con copyright.
- Sin autenticación ni persistencia server-side en el MVP (decisiones explícitas, ver definición).
- Despliegue: mismo patrón `Jenkinsfile` + Shared Library `platform`, Traefik, ramas `dev`/`qa`/`prod`, que `auth-core-mc`/`mail-core-mc`.
