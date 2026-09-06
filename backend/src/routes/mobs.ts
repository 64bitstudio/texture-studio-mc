import { Router } from 'express';
import { listMobs } from '../mobs/registry.js';

// GET /api/mobs (ticket 016) -- catalogo de mobs soportados, para que el
// frontend arme el menu de seleccion (ticket 018). Ver docs/API.md para
// el contrato completo.
export const mobsRouter = Router();

mobsRouter.get('/api/mobs', (_req, res) => {
  res.status(200).json({ mobs: listMobs() });
});
