// Ticket 087 -- proxy minimo hacia la API gratuita de Gemini, para que
// el modo automatico de asistencia de IA (Etapas 1/3/4, ver
// docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md) no
// exponga la API key en el navegador. Primera vez que este backend
// "deliberadamente minimo" (ver docs/ARQUITECTURA.md) hace algo mas que
// servir estaticos y el catalogo de mobs -- cambio de alcance senalado
// explicitamente en el documento de definicion, confirmado con Marco.
//
// El PROMPT ya viene armado desde el frontend -- el mismo texto que se
// le pediria copiar/pegar en el modo puente manual (`AIAssistProvider`,
// tickets 088/089/091) -- este servicio no sabe nada de geometria,
// color ni animacion, solo sabe "mandar un prompt a Gemini y devolver
// el JSON que responda".
//
// Reintentos con backoff (ticket 081, hallazgo real): el free tier de
// Gemini tuvo ~20% de fallos de infraestructura (503/timeout/429) en el
// spike de evaluacion, incluso con reintentos -- un solo intento fallido
// no debe rendirse de inmediato.

export interface AiAssistError extends Error {
  /** Status HTTP que la ruta debe usar para responder al cliente. */
  status: number;
}

function makeError(message: string, status: number): AiAssistError {
  const err = new Error(message) as AiAssistError;
  err.status = status;
  return err;
}

function isAiAssistError(value: unknown): value is AiAssistError {
  return value instanceof Error && typeof (value as Partial<AiAssistError>).status === 'number';
}

const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const MAX_ATTEMPTS = 3;
/** Codigos de status documentados como transitorios en el spike del ticket 081. */
const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

interface GeminiGenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

type AttemptOutcome = { ok: true; value: unknown } | { ok: false; error: AiAssistError; retryable: boolean };

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptGeminiCall(url: string, requestBody: string): Promise<AttemptOutcome> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody });
  } catch (err) {
    return { ok: false, error: makeError(`No se pudo contactar a la IA: ${(err as Error).message}`, 502), retryable: true };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: makeError(`La API de IA respondio con un error (${res.status}).`, 502),
      retryable: RETRYABLE_HTTP_STATUS.has(res.status),
    };
  }

  let data: GeminiGenerateContentResponse;
  try {
    data = (await res.json()) as GeminiGenerateContentResponse;
  } catch {
    return { ok: false, error: makeError('La IA devolvio una respuesta ilegible.', 502), retryable: true };
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return { ok: false, error: makeError('La IA no devolvio contenido utilizable.', 502), retryable: true };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: makeError('La IA devolvio un JSON invalido.', 502), retryable: true };
  }
}

/**
 * Envia `prompt` a la API de Gemini (con `generationConfig.responseMimeType:
 * "application/json"`, misma tecnica ya validada en el spike del ticket
 * 081) y devuelve el JSON ya parseado.
 *
 * Reintenta hasta `MAX_ATTEMPTS` veces con backoff exponencial ante
 * errores transitorios (`RETRYABLE_HTTP_STATUS`, o cualquier fallo de
 * red) -- un error NO transitorio (ej. prompt vacio, API key ausente,
 * modelo no encontrado) se propaga de inmediato, sin reintentar.
 *
 * `delayFn` es inyectable solo para tests (evita esperas reales de
 * segundos en la suite) -- el default es un backoff real.
 */
export async function requestAiJsonProposal(
  prompt: string,
  options: { delayFn?: (ms: number) => Promise<void> } = {},
): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw makeError('La IA no esta configurada en este servidor (falta GEMINI_API_KEY).', 500);
  }
  if (!prompt?.trim()) {
    throw makeError('El campo "prompt" es requerido.', 400);
  }

  // Base del backoff configurable por variable de entorno -- permite
  // que los tests de integracion (via supertest, sin acceso a
  // `options.delayFn`) corran los 3 intentos sin esperar segundos
  // reales, sin exponer un parametro de "solo para tests" en la API
  // publica que consumen las rutas.
  const retryBaseMs = Number(process.env.AI_ASSIST_RETRY_BASE_MS) || 500;
  const delay = options.delayFn ?? realSleep;
  // `||`, no `??`: un despliegue real (docker-compose `environment:
  // GEMINI_MODEL: ${GEMINI_MODEL}` sin valor en el .env) deja la
  // variable como STRING VACIO, no ausente -- `??` no cae al default en
  // ese caso (hallazgo real, encontrado configurando el despliegue de
  // dev), rompiendo la llamada a Gemini con un nombre de modelo vacio.
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });

  let lastError: AiAssistError = makeError('Fallo desconocido llamando a la IA.', 502);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const outcome = await attemptGeminiCall(url, requestBody);
    if (outcome.ok) {
      return outcome.value;
    }

    lastError = outcome.error;
    if (!outcome.retryable || attempt === MAX_ATTEMPTS) {
      break;
    }
    await delay(retryBaseMs * 2 ** (attempt - 1));
  }

  throw makeError(`${lastError.message} (reintentado ${MAX_ATTEMPTS} veces) -- usa el modo puente manual como respaldo.`, lastError.status);
}

export { isAiAssistError };
