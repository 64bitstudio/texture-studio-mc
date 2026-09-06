import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

// Fixtures de los mobs "biped clasico" registrados (ticket 016 + 017) --
// la geometria compartida (cabeza/torso fijos, faceLabels, mirrorX) se
// verifica UNA sola vez via `describe.each` en vez de repetir el mismo
// bloque de asserts por mob (extraido al reducir la duplicacion que
// senalo el gate de calidad de SonarQube en la version anterior de este
// archivo) -- cada fixture solo aporta los valores que SI son propios
// de ese mob, ya verificados contra `bedrock-samples` + el asset real
// (ver `backend/src/geometry/skeletonGeometry.ts`/`zombieGeometry.ts`).
interface ClassicBipedFixture {
  mobId: string;
  /** Alto real del PNG servido (32 para el Esqueleto, 64 para el Zombie -- ver ticket 017). */
  textureHeight: number;
  /** `[ancho, alto, profundidad]` de brazos/piernas de este mob. */
  limbSize: [number, number, number];
  armOffsetX: number;
  legOffsetX: number;
  /** Nota corta para el titulo del test (que diferencia a este mob). */
  note: string;
}

const CLASSIC_BIPED_FIXTURES: ClassicBipedFixture[] = [
  {
    mobId: 'skeleton',
    textureHeight: 32,
    limbSize: [2, 12, 2],
    armOffsetX: 5,
    legOffsetX: 2,
    note: 'huesos delgados, ticket 009',
  },
  {
    mobId: 'zombie',
    textureHeight: 64,
    limbSize: [4, 12, 4],
    armOffsetX: 6,
    legOffsetX: 1.9,
    note: 'brazos/piernas gruesos tipo Steve + textura 64x64, ticket 017',
  },
];

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

  it('responde 200 con textura placeholder cuando no hay asset real', async () => {
    const app = createApp();
    const res = await request(app).get('/api/base-assets/skeleton');

    expect(res.status).toBe(200);
    expect(res.body.texture.isPlaceholder).toBe(true);
    expect(res.body.texture.dataUrl).toMatch(/^data:image\/png;base64,/);
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

  describe.each(CLASSIC_BIPED_FIXTURES)('$mobId ($note)', ({ mobId, textureHeight, limbSize, armOffsetX, legOffsetX }) => {
    it('responde con las 6 cajas del biped clasico -- dimensiones/posicion/UV/mirror correctos', async () => {
      const app = createApp();
      const res = await request(app).get(`/api/base-assets/${mobId}`);

      expect(res.status).toBe(200);
      expect(res.body.texture.width).toBe(64);
      expect(res.body.texture.height).toBe(textureHeight);
      expect(res.body.geometry.textureWidth).toBe(64);
      expect(res.body.geometry.textureHeight).toBe(textureHeight);

      const { head, body, armRight, armLeft, legRight, legLeft } = res.body.geometry.parts;

      // Cabeza y torso son IDENTICOS en cualquier biped clasico (ver
      // `classicBipedGeometry.ts`) -- no varian por mob.
      expect(head.size).toEqual([8, 8, 8]);
      expect(head.position).toEqual([0, 28, 0]);
      expect(head.uv).toEqual({ x: 0, y: 0 });
      expect(body.size).toEqual([8, 12, 4]);
      expect(body.position).toEqual([0, 18, 0]);
      expect(body.uv).toEqual({ x: 16, y: 16 });

      // Brazos/piernas: lo unico que SI varia por mob.
      expect(armRight.size).toEqual(limbSize);
      expect(armRight.position).toEqual([-armOffsetX, 18, 0]);
      expect(armRight.uv).toEqual({ x: 40, y: 16 });
      expect(armLeft.size).toEqual(limbSize);
      expect(armLeft.position).toEqual([armOffsetX, 18, 0]);
      expect(armLeft.uv).toEqual({ x: 40, y: 16 });
      expect(armLeft.mirrorX).toBe(true);

      expect(legRight.size).toEqual(limbSize);
      expect(legRight.position).toEqual([-legOffsetX, 6, 0]);
      expect(legRight.uv).toEqual({ x: 0, y: 16 });
      expect(legLeft.size).toEqual(limbSize);
      expect(legLeft.position).toEqual([legOffsetX, 6, 0]);
      expect(legLeft.uv).toEqual({ x: 0, y: 16 });
      expect(legLeft.mirrorX).toBe(true);
    });

    it('incluye faceLabels legibles por cada caja, sin lateralidad en brazo/pierna (ticket 011)', async () => {
      const app = createApp();
      const res = await request(app).get(`/api/base-assets/${mobId}`);
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

      // armRight/armLeft (y legRight/legLeft) comparten la misma region
      // UV (mismo `uv`, mismo tamaño) -- sus labels deben ser identicos
      // y sin lateralidad, para no sugerir que solo un lado se pinta
      // (ver docs/ARQUITECTURA.md, "Ticket 011").
      expect(armRight.faceLabels).toEqual(armLeft.faceLabels);
      expect(armRight.faceLabels.front).not.toMatch(/derech|izquierd/i);
      expect(legRight.faceLabels).toEqual(legLeft.faceLabels);
      expect(legRight.faceLabels.front).not.toMatch(/derech|izquierd/i);
    });
  });
});
