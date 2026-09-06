import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

// Ticket 016: catalogo de mobs soportados, consumido por el selector de
// mob del frontend (ticket 018).
describe('GET /api/mobs', () => {
  it('devuelve el catalogo con Esqueleto, Zombie (ticket 017), Araña (ticket 020) y Creeper (ticket 021)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/mobs');

    expect(res.status).toBe(200);
    expect(res.body.mobs).toContainEqual({ id: 'skeleton', label: 'Esqueleto' });
    expect(res.body.mobs).toContainEqual({ id: 'zombie', label: 'Zombie' });
    expect(res.body.mobs).toContainEqual({ id: 'spider', label: 'Araña' });
    expect(res.body.mobs).toContainEqual({ id: 'creeper', label: 'Creeper' });
  });

  it('cada entrada solo expone id y label (sin geometria/detalles internos)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/mobs');

    for (const mob of res.body.mobs) {
      expect(Object.keys(mob).sort()).toEqual(['id', 'label']);
    }
  });
});
