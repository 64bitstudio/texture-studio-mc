# Texture Studio MC

Editor visual 3D de texturas de Minecraft (Java Edition). MVP: mob Esqueleto — carga el modelo vanilla en 3D, permite pintarlo pixel a pixel con sincronía en vivo, y exporta el PNG o el ZIP del resource pack completo.

Ver `docs/definiciones/editor-3d-texturas-esqueleto.md` para el alcance completo, Historias de Usuario y diseño técnico (documento con VoBo, fuente de verdad del proyecto).

## Instalación / desarrollo local

_Pendiente — se completa cuando exista el scaffold real de `frontend/`/`backend/` (ticket 001)._

## Stack

- **Frontend:** React + Vite + TypeScript, `three.js` vía `@react-three/fiber`/`drei` (visor 3D), `<canvas>` 2D nativo (editor de textura pixel a pixel), `JSZip` (export de resource pack, 100% en el navegador).
- **Backend:** Node.js mínimo — sirve el build estático del frontend y el asset vanilla base (fuera de git, ver `docs/ARQUITECTURA.md`).
- **Despliegue:** VM Ampere de Marco, mismo patrón que `auth-core-mc`/`mail-core-mc` (Jenkinsfile + Shared Library de `platform`, Traefik, `dev`/`qa`/`prod`).
