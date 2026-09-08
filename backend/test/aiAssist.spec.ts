// Ticket 087 -- proxy de IA (Gemini) con reintentos y backoff.
// Ver docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { requestAiJsonProposal } from '../src/services/aiAssist.js';

function geminiSuccessResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    { status: 200 },
  );
}

describe('requestAiJsonProposal (unit -- retries con backoff inyectable)', () => {
  const ORIGINAL_KEY = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = ORIGINAL_KEY;
    vi.unstubAllGlobals();
  });

  it('rechaza sin reintentar si falta GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(requestAiJsonProposal('hola')).rejects.toMatchObject({ status: 500 });
  });

  it('rechaza sin reintentar un prompt vacio', async () => {
    await expect(requestAiJsonProposal('   ')).rejects.toMatchObject({ status: 400 });
  });

  it('devuelve el JSON parseado en el primer intento exitoso', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiSuccessResponse({ ok: true, value: 42 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAiJsonProposal('describe una animacion de caminar');

    expect(result).toEqual({ ok: true, value: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('usa el modelo por defecto si GEMINI_MODEL llega como string vacio, no solo ausente (hallazgo real: asi llega desde docker-compose sin valor en el .env)', async () => {
    const ORIGINAL_MODEL = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = '';
    const fetchMock = vi.fn().mockResolvedValue(geminiSuccessResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      await requestAiJsonProposal('describe una animacion de caminar');
      const calledUrl = fetchMock.mock.calls[0]![0] as string;
      expect(calledUrl).toContain('/models/gemini-3.6-flash:generateContent');
    } finally {
      process.env.GEMINI_MODEL = ORIGINAL_MODEL;
    }
  });

  it('reintenta ante un 503 (transitorio, ver hallazgo del spike 081) y se recupera en el segundo intento', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('sobrecargado', { status: 503 }))
      .mockResolvedValueOnce(geminiSuccessResponse({ recovered: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAiJsonProposal('hola', { delayFn: () => Promise.resolve() });

    expect(result).toEqual({ recovered: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('agota los 3 intentos ante fallos persistentes (429) y lanza un error claro mencionando el puente manual', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestAiJsonProposal('hola', { delayFn: () => Promise.resolve() })).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('puente manual'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('NO reintenta ante un error no transitorio (ej. 404 -- modelo inexistente)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestAiJsonProposal('hola', { delayFn: () => Promise.resolve() })).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('trata un JSON invalido devuelto por la IA como error (no lo deja pasar silenciosamente)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'esto no es JSON{{{' }] } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestAiJsonProposal('hola', { delayFn: () => Promise.resolve() })).rejects.toMatchObject({ status: 502 });
  });
});

describe('POST /api/ai/propose-* (integracion via supertest)', () => {
  const ORIGINAL_KEY = process.env.GEMINI_API_KEY;
  const ORIGINAL_RETRY_BASE = process.env.AI_ASSIST_RETRY_BASE_MS;
  const app = createApp();

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    // Backoff casi instantaneo -- estas pruebas no pueden inyectar
    // `delayFn` (llegan por HTTP real, no llaman al servicio
    // directamente), ver comentario de `AI_ASSIST_RETRY_BASE_MS` en
    // `services/aiAssist.ts`.
    process.env.AI_ASSIST_RETRY_BASE_MS = '1';
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = ORIGINAL_KEY;
    process.env.AI_ASSIST_RETRY_BASE_MS = ORIGINAL_RETRY_BASE;
    vi.unstubAllGlobals();
  });

  it.each(['/api/ai/propose-geometry', '/api/ai/propose-color', '/api/ai/propose-animation'])(
    '%s: caso de exito -- devuelve 200 con el JSON de la IA ya parseado',
    async (path) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiSuccessResponse({ parts: [] })));

      const res = await request(app).post(path).send({ prompt: 'genera una propuesta' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ result: { parts: [] } });
    },
  );

  it('rechaza con 400 si falta el prompt', async () => {
    const res = await request(app).post('/api/ai/propose-geometry').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/prompt/);
  });

  it('rechaza con 500 si el servidor no tiene GEMINI_API_KEY configurada', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await request(app).post('/api/ai/propose-geometry').send({ prompt: 'hola' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/GEMINI_API_KEY/);
  });

  it('caso de cuota excedida: 429 persistente en la API externa se traduce a 502 tras agotar los reintentos', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app).post('/api/ai/propose-color').send({ prompt: 'colorea de verde' });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/puente manual/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
