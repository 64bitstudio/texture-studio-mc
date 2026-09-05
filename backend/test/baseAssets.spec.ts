import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /api/base-assets/skeleton', () => {
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
    expect(armRight.uv).toEqual({ x: 40, y: 16 });
    expect(armLeft.mirrorX).toBe(true);
    expect(legRight.uv).toEqual({ x: 0, y: 16 });
    expect(legLeft.mirrorX).toBe(true);
  });

  it('nunca responde con error aunque falte el asset vanilla real', async () => {
    const app = createApp();
    const res = await request(app).get('/api/base-assets/skeleton');
    expect(res.status).not.toBe(500);
  });
});
