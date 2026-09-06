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

    it('incluye faceLabels legibles por cada caja, sin lateralidad en brazo/pierna (ticket 011), left/right relativos a la pantalla (ticket 023)', async () => {
      const app = createApp();
      const res = await request(app).get(`/api/base-assets/${mobId}`);
      const { head, body, armRight, armLeft, legRight, legLeft } = res.body.geometry.parts;

      expect(head.faceLabels).toEqual({
        front: 'Cara',
        back: 'Nuca',
        top: 'Parte superior',
        bottom: 'Parte inferior',
        left: 'Lateral izquierdo',
        right: 'Lateral derecho',
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

  // La Araña (ticket 020) NO es un biped clasico -- no tiene brazos, y
  // tiene 8 patas en vez de 2 piernas, todas compartiendo la MISMA
  // region UV (ni siquiera derecho/izquierdo separados como
  // armRight/legRight). No cabe en `CLASSIC_BIPED_FIXTURES`, tiene su
  // propio bloque. Valores verificados contra
  // `Mojang/bedrock-samples/spider.geo.json` + el asset vanilla real
  // cacheado -- ver `backend/src/geometry/spiderGeometry.ts` para la
  // investigacion completa.
  describe('spider (anatomia no-biped, ticket 020)', () => {
    it('responde con textura 64x32 y las 3 cajas de cuerpo (cabeza/torax/abdomen) correctas', async () => {
      const app = createApp();
      const res = await request(app).get('/api/base-assets/spider');

      expect(res.status).toBe(200);
      expect(res.body.texture.width).toBe(64);
      expect(res.body.texture.height).toBe(32);
      expect(res.body.geometry.textureWidth).toBe(64);
      expect(res.body.geometry.textureHeight).toBe(32);

      const { head, thorax, abdomen } = res.body.geometry.parts;
      expect(head.size).toEqual([8, 8, 8]);
      expect(head.position).toEqual([0, 9, -7]);
      expect(head.uv).toEqual({ x: 32, y: 4 });
      expect(thorax.size).toEqual([6, 6, 6]);
      expect(thorax.position).toEqual([0, 9, 0]);
      expect(thorax.uv).toEqual({ x: 0, y: 0 });
      expect(abdomen.size).toEqual([10, 8, 12]);
      expect(abdomen.position).toEqual([0, 9, 9]);
      expect(abdomen.uv).toEqual({ x: 0, y: 12 });
    });

    it('tiene 8 patas, todas del mismo tamaño y compartiendo el mismo UV -- 4 pares mirror derecho/izquierdo', async () => {
      const app = createApp();
      const res = await request(app).get('/api/base-assets/spider');
      const { parts } = res.body.geometry;

      const legKeys = Object.keys(parts).filter((k) => k.startsWith('leg'));
      expect(legKeys).toHaveLength(8);

      for (const key of legKeys) {
        expect(parts[key].size).toEqual([16, 2, 2]);
        expect(parts[key].uv).toEqual({ x: 18, y: 0 });
        expect(parts[key].group).toBe('spiderLeg');
        // Lado anatomico derecho (x<0) sin mirror; izquierdo (x>0) con mirror.
        if (parts[key].position[0] < 0) {
          expect(parts[key].mirrorX).toBeFalsy();
        } else {
          expect(parts[key].mirrorX).toBe(true);
        }
      }

      // 4 pares unicos en z (uno por cada "Right"/"Left").
      const zValues = new Set(legKeys.map((k) => parts[k].position[2]));
      expect(zValues.size).toBe(4);
    });

    it('las 8 patas comparten faceLabels identicos y sin lateralidad', async () => {
      const app = createApp();
      const res = await request(app).get('/api/base-assets/spider');
      const { parts } = res.body.geometry;
      const legKeys = Object.keys(parts).filter((k) => k.startsWith('leg'));

      const firstLabels = parts[legKeys[0]].faceLabels;
      for (const key of legKeys) {
        expect(parts[key].faceLabels).toEqual(firstLabels);
      }
      expect(firstLabels.front).not.toMatch(/derech|izquierd/i);
    });

    it('las 8 patas traen pivot/rotation (ticket 024, pose oficial de animation.spider.default_leg_pose)', async () => {
      const app = createApp();
      const res = await request(app).get('/api/base-assets/spider');
      const { parts } = res.body.geometry;
      const legKeys = Object.keys(parts).filter((k) => k.startsWith('leg'));

      for (const key of legKeys) {
        const leg = parts[key];
        expect(leg.pivot).toHaveLength(3);
        expect(leg.rotation).toHaveLength(3);
        // El eje X nunca lo toca la animacion oficial (rotar una pata
        // sobre su propio eje de extension no mueve su punta).
        expect(leg.rotation[0]).toBe(0);
        // El pivote es el punto de union con el cuerpo (cerca de
        // position.x/z, NO el centro de la caja -- la caja se extiende
        // 7 unidades desde ahi).
        expect(Math.abs(leg.pivot[0])).toBe(4);
        expect(leg.pivot[1]).toBe(9);
        expect(leg.pivot[2]).toBe(leg.position[2]);
      }

      // Lado derecho (mirrorX ausente) y su contraparte izquierda
      // (mirrorX) deben tener la MISMA rotacion en Y y Z con signo
      // invertido (reflejo especular real, no solo el `mirrorX` de la
      // textura) -- ej. leg1Right/leg1Left.
      const right = parts.leg1Right;
      const left = parts.leg1Left;
      expect(left.rotation[1]).toBe(-right.rotation[1]);
      expect(left.rotation[2]).toBe(-right.rotation[2]);
    });
  });

  // El Creeper (ticket 021) es la segunda anatomia no-biped: cabeza +
  // cuerpo (sin torso/tórax/abdomen separados) + 4 patas cortas, sin
  // brazos. A diferencia de la Araña, sus 4 patas NO llevan `mirrorX`
  // en la fuente oficial (`bedrock-samples/creeper.geo.json`) -- se
  // verifica explicitamente que este proyecto no lo inventa. Su asset
  // vanilla real tuvo que extraerse primero (no estaba cacheado) -- ver
  // `backend/src/geometry/creeperGeometry.ts` para la investigacion
  // completa.
  describe('creeper (anatomia no-biped, ticket 021)', () => {
    it('responde con textura 64x32 y las cajas de cabeza/cuerpo correctas', async () => {
      const app = createApp();
      const res = await request(app).get('/api/base-assets/creeper');

      expect(res.status).toBe(200);
      expect(res.body.texture.width).toBe(64);
      expect(res.body.texture.height).toBe(32);
      expect(res.body.geometry.textureWidth).toBe(64);
      expect(res.body.geometry.textureHeight).toBe(32);

      const { head, body } = res.body.geometry.parts;
      expect(head.size).toEqual([8, 8, 8]);
      expect(head.position).toEqual([0, 22, 0]);
      expect(head.uv).toEqual({ x: 0, y: 0 });
      expect(body.size).toEqual([8, 12, 4]);
      expect(body.position).toEqual([0, 12, 0]);
      expect(body.uv).toEqual({ x: 16, y: 16 });
    });

    it('tiene 4 patas, todas del mismo tamaño y UV, sin mirrorX (no esta en la fuente oficial)', async () => {
      const app = createApp();
      const res = await request(app).get('/api/base-assets/creeper');
      const { parts } = res.body.geometry;

      const legKeys = Object.keys(parts).filter((k) => k.startsWith('leg'));
      expect(legKeys).toHaveLength(4);

      for (const key of legKeys) {
        expect(parts[key].size).toEqual([4, 6, 4]);
        expect(parts[key].uv).toEqual({ x: 0, y: 16 });
        expect(parts[key].group).toBe('creeperLeg');
        expect(parts[key].mirrorX).toBeFalsy();
      }

      // 4 posiciones unicas (una por esquina: frente/atras x derecha/izquierda).
      const positions = new Set(legKeys.map((k) => parts[k].position.join(',')));
      expect(positions.size).toBe(4);
    });

    it('las 4 patas comparten faceLabels identicos y sin lateralidad', async () => {
      const app = createApp();
      const res = await request(app).get('/api/base-assets/creeper');
      const { parts } = res.body.geometry;
      const legKeys = Object.keys(parts).filter((k) => k.startsWith('leg'));

      const firstLabels = parts[legKeys[0]].faceLabels;
      for (const key of legKeys) {
        expect(parts[key].faceLabels).toEqual(firstLabels);
      }
      expect(firstLabels.front).not.toMatch(/derech|izquierd/i);
    });
  });
});
