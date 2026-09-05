# Texture Studio MC

Editor visual 3D de texturas de Minecraft (Java Edition). MVP: mob Esqueleto — carga el modelo vanilla en 3D, permite pintarlo pixel a pixel con sincronía en vivo, y exporta el PNG o el ZIP del resource pack completo.

Ver `docs/definiciones/editor-3d-texturas-esqueleto.md` para el alcance completo, Historias de Usuario y diseño técnico (documento con VoBo, fuente de verdad del proyecto).

## Stack

- **Frontend** (`frontend/`): React + Vite + TypeScript, `three.js` vía `@react-three/fiber`/`drei` (visor 3D), `<canvas>` 2D nativo (editor de textura pixel a pixel — ticket 002), `TextureBuffer` compartido con sync en vivo al modelo 3D (ticket 002), `JSZip` (export de resource pack — ticket 006, 100% en el navegador).
- **Backend** (`backend/`): Node.js + Express + TypeScript, deliberadamente mínimo — sirve el build estático del frontend y el asset vanilla base (fuera de git, ver `docs/ARQUITECTURA.md`). Sin base de datos ni autenticación.
- **Despliegue**: VM Ampere de Marco, mismo patrón que `auth-core-mc`/`mail-core-mc` (Jenkinsfile + Shared Library de `platform`, Traefik, `dev`/`qa`/`prod`).

## Instalación / desarrollo local

Requisitos: Node.js 24+.

### Backend

```bash
cd backend
npm install
npm run dev      # tsx watch, recarga en caliente -- escucha en :3000
```

Endpoints disponibles de inmediato: `GET /health` y `GET /api/base-assets/skeleton` (sirve un placeholder procedural mientras no exista `backend/vanilla-assets/skeleton.png` -- ver `docs/ARQUITECTURA.md`).

### Frontend

```bash
cd frontend
npm install
npm run dev       # Vite -- abre en :5173
```

El frontend en dev (`:5173`) proxea `/api` y `/health` hacia el backend en `:3000` (ver `frontend/vite.config.ts`) -- corre ambos (`backend` y `frontend`) en paralelo, en dos terminales.

Para probar el flujo integrado (como en producción, un solo proceso Node sirviendo todo):

```bash
cd frontend && npm run build
cd ../backend && npm run build
cp -r ../frontend/dist/. ./public/
npm start          # sirve todo en :3000 (http://localhost:3000)
```

### Tests y lint

```bash
cd backend
npm run lint
npm test          # o npm run test:cov para cobertura (usada por SonarQube en CI)

cd ../frontend
npm run lint
npm test          # Vitest -- cubre la lógica pura de TextureBuffer (ticket 002), PaintHistory/undo-redo (ticket 003) y simetría de pintura (ticket 004), ver docs/COMPONENTES.md
npm run build
```

## Estructura del repo

```
texture-studio-mc/
├── frontend/          # SPA Vite+React+TS -- ver docs/COMPONENTES.md
├── backend/           # API minima Express+TS -- ver docs/API.md
├── deploy/            # docker-compose.{dev,qa,prod}.yml, cleanup.sh, vhost nginx, .env.*.example
├── docs/              # documentación viva del proyecto (este archivo + ARQUITECTURA/API/COMPONENTES/definiciones)
├── postman/           # colección Postman de los endpoints del backend
├── pending/ in-process/ done/   # tickets (convención del equipo)
└── Jenkinsfile        # pipeline CI/CD (Shared Library `platform`)
```
