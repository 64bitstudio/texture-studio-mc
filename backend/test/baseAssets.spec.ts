import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /api/base-assets/:mobId', () => {
  const ORIGINAL_ENV = process.env.VANILLA_ASSETS_DIR;

  beforeEach(() => {
    // Directorio inexistente a proposito -- fuerza el fallback al
    // placeholder sin depender de que el checkout tenga (o no)
    // vanilla-assets/ poblado.
    process.env.VANILLA_ASSETS_DIR = '/tmp/texture-studio-mc-test-no-such-dir';
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.VANILLA_ASSETS_DIR;
    } else {
      process.env.VANILLA_ASSETS_DIR = ORIGINAL_ENV;
    }
  });

  it('responde 200 con textura placeholder + geometria cuando no hay asset real', async () => {
    const app = createApp();
    const res = await request(app).get('/api/base-assets/skeleton');

    expect(res.status).toBe(200);
    expect(res.body.texture.isPlaceholder).toBe(true);
    expect(res.body.texture.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(res.body.texture.width).toBe(64);
    expect(res.body.texture.height).toBe(32);

    expect(res.body.geometry.textureWidth).toBe(64);
    expect(res.body.geometry.textureHeight).toBe(32);
    const { head, body, armRight, armLeft, legRight, legLeft } = res.body.geometry.parts;
    expect(head.size).toEqual([8, 8, 8]);
    expect(head.uv).toEqual({ x: 0, y: 0 });
    expect(body.size).toEqual([8, 12, 4]);
    expect(body.uv).toEqual({ x: 16, y: 16 });

    // Ticket 009: brazos/piernas delgados (size [2,12,2], no [4,12,4] --
    // ver docs/ARQUITECTURA.md "Ticket 009" para la fuente/verificacion).
    expect(armRight.size).toEqual([2, 12, 2]);
    expect(armRight.position).toEqual([-5, 18, 0]);
    expect(armRight.uv).toEqual({ x: 40, y: 16 });
    expect(armLeft.size).toEqual([2, 12, 2]);
    expect(armLeft.position).toEqual([5, 18, 0]);
    expect(armLeft.mirrorX).toBe(true);
    expect(legRight.size).toEqual([2, 12, 2]);
    expect(legRight.position).toEqual([-2, 6, 0]);
    expect(legRight.uv).toEqual({ x: 0, y: 16 });
    expect(legLeft.size).toEqual([2, 12, 2]);
    expect(legLeft.position).toEqual([2, 6, 0]);
    expect(legLeft.mirrorX).toBe(true);
  });

  it('incluye faceLabels legibles por cada caja (ticket 011)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/base-assets/skeleton');
    const { head, body, armRight, armLeft, legRight, legLeft } = res.body.geometry.parts;

    expect(head.faceLabels).toEqual({
      front: 'Cara',
      back: 'Nuca',
      top: 'Parte superior',
      bottom: 'Parte inferior',
      left: 'Lateral derecho',
      right: 'Lateral izquierdo',
    });
    expect(body.faceLabels).toMatchObject({ front: 'Pecho', back: 'Espalda' });

    // armRight/armLeft (y legRight/legLeft) comparten la misma region UV
    // (mismo `uv`, mismo tamaño) -- sus labels deben ser identicos y sin
    // lateralidad, para no sugerir que solo un lado se pinta (ver
    // docs/ARQUITECTURA.md, "Ticket 011").
    expect(armRight.faceLabels).toEqual(armLeft.faceLabels);
    expect(armRight.faceLabels.front).not.toMatch(/derech|izquierd/i);
    expect(legRight.faceLabels).toEqual(legLeft.faceLabels);
    expect(legRight.faceLabels.front).not.toMatch(/derech|izquierd/i);
  });

  it('nunca responde con error aunque falte el asset vanilla real', async () => {
    const app = createApp();
    const res = await request(app).get('/api/base-assets/skeleton');
    expect(res.status).not.toBe(500);
  });

  it('responde 404 con mensaje claro para un mob que no existe en el registro (ticket 016)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/base-assets/mob-inexistente');

    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  // Ticket 017: geometria del Zombie -- misma anatomia de 6 cajas que el
  // Esqueleto, pero brazos/piernas gruesos (tipo Steve) y textura 64x64
  // (no 64x32) -- ver docs/ARQUITECTURA.md "Ticket 017" y los comentarios
  // de `backend/src/geometry/zombieGeometry.ts` para la verificacion
  // contra bedrock-samples + el asset vanilla real.
  it('responde 200 con la geometria del Zombie (dimensiones/UV/mirror verificados contra bedrock-samples)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/base-assets/zombie');

    expect(res.status).toBe(200);
    expect(res.body.texture.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(res.body.texture.width).toBe(64);
    expect(res.body.texture.height).toBe(64);

    expect(res.body.geometry.textureWidth).toBe(64);
    expect(res.body.geometry.textureHeight).toBe(64);
    const { head, body, armRight, armLeft, legRight, legLeft } = res.body.geometry.parts;

    expect(head.size).toEqual([8, 8, 8]);
    expect(head.position).toEqual([0, 28, 0]);
    expect(head.uv).toEqual({ x: 0, y: 0 });

    expect(body.size).toEqual([8, 12, 4]);
    expect(body.position).toEqual([0, 18, 0]);
    expect(body.uv).toEqual({ x: 16, y: 16 });

    // Brazos/piernas gruesos [4,12,4] -- NO los huesos delgados [2,12,2]
    // del Esqueleto (ticket 009).
    expect(armRight.size).toEqual([4, 12, 4]);
    expect(armRight.position).toEqual([-6, 18, 0]);
    expect(armRight.uv).toEqual({ x: 40, y: 16 });
    expect(armLeft.size).toEqual([4, 12, 4]);
    expect(armLeft.position).toEqual([6, 18, 0]);
    expect(armLeft.uv).toEqual({ x: 40, y: 16 });
    expect(armLeft.mirrorX).toBe(true);

    expect(legRight.size).toEqual([4, 12, 4]);
    expect(legRight.position).toEqual([-1.9, 6, 0]);
    expect(legRight.uv).toEqual({ x: 0, y: 16 });
    expect(legLeft.size).toEqual([4, 12, 4]);
    expect(legLeft.position).toEqual([1.9, 6, 0]);
    expect(legLeft.uv).toEqual({ x: 0, y: 16 });
    expect(legLeft.mirrorX).toBe(true);
  });

  it('incluye faceLabels legibles para el Zombie, sin lateralidad en brazo/pierna (ticket 011)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/base-assets/zombie');
    const { head, body, armRight, armLeft, legRight, legLeft } = res.body.geometry.parts;

    expect(head.faceLabels).toEqual({
      front: 'Cara',
      back: 'Nuca',
      top: 'Parte superior',
      bottom: 'Parte inferior',
      left: 'Lateral derecho',
      right: 'Lateral izquierdo',
    });
    expect(body.faceLabels).toMatchObject({ front: 'Pecho', back: 'Espalda' });

    expect(armRight.faceLabels).toEqual(armLeft.faceLabels);
    expect(armRight.faceLabels.front).not.toMatch(/derech|izquierd/i);
    expect(legRight.faceLabels).toEqual(legLeft.faceLabels);
    expect(legRight.faceLabels.front).not.toMatch(/derech|izquierd/i);
  });
});
