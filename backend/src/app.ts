import express from 'express';
import path from 'node:path';
import { healthRouter } from './routes/health.js';
import { baseAssetsRouter } from './routes/baseAssets.js';
import { mobsRouter } from './routes/mobs.js';
import { aiAssistRouter } from './routes/aiAssist.js';

// Directorio del build estatico del frontend (ver Dockerfile: el stage
// runtime copia frontend/dist aqui). Configurable via env var solo para
// tests/dev; en despliegue real siempre es el default (WORKDIR /app ->
// /app/public).
const FRONTEND_DIST_DIR = process.env.FRONTEND_DIST_DIR ?? path.resolve(process.cwd(), 'public');

/**
 * Backend deliberadamente minimo (ver docs/ARQUITECTURA.md): sin auth,
 * sin persistencia. Expone el catalogo y el asset base de los mobs del
 * registro (`MOB_REGISTRY`), el proxy de asistencia de IA (ticket 087 --
 * primera vez que este backend hace algo mas que servir estaticos y el
 * catalogo, ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md),
 * y sirve el build estatico del frontend.
 */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Requerido por `aiAssistRouter` (ticket 087) -- primera vez que una
  // ruta de este backend necesita parsear un body JSON (las rutas
  // anteriores son todas GET). Limite explicito de 256kb: un prompt de
  // IA (geometria/textura serializada + descripcion) nunca deberia
  // acercarse a eso; evita que un body gigante/malformado se procese
  // sin limite.
  app.use(express.json({ limit: '256kb' }));

  app.use(healthRouter);
  app.use(mobsRouter);
  app.use(baseAssetsRouter);
  app.use(aiAssistRouter);

  // En dev local esta carpeta normalmente no existe (el frontend corre
  // con su propio servidor de Vite -- ver docs/README.md); express.static
  // simplemente no encuentra archivos y el catch-all de abajo responde
  // 404, sin romper el arranque del backend.
  app.use(express.static(FRONTEND_DIST_DIR));
  app.get('/*splat', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST_DIR, 'index.html'), (err) => {
      if (err) {
        res.status(404).send('Not found');
      }
    });
  });

  return app;
}
