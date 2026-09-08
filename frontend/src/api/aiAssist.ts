// Ticket 088 -- cliente del proxy de IA (ticket 087). Mismo patron ya
// establecido en `api/baseAssets.ts`/`api/mobs.ts`: ruta relativa
// (funciona con el proxy de Vite en dev y servida por el mismo origen
// en produccion), lanza un `Error` legible si la respuesta no es `ok`.
//
// Un solo helper generico para las 3 variantes (geometria/color/
// animacion, tickets 088/089/091) -- las 3 comparten EXACTAMENTE el
// mismo contrato (`POST { prompt } -> { result }`), solo cambia el
// `kind` (y por tanto la ruta) segun de que etapa del editor se llame.

export type AiAssistKind = 'geometry' | 'color' | 'animation';

/**
 * Envia `prompt` (ya armado por quien llama -- `buildGeometryProposalPrompt`
 * y equivalentes) al proxy de IA del backend (ticket 087) y devuelve el
 * JSON crudo que la IA respondio, sin validar todavia -- la validacion
 * de forma (ej. `validateAndApplyGeometryProposal`) es responsabilidad
 * de quien consume este cliente, igual que en el modo puente manual
 * (donde el usuario pega el JSON a mano): un solo camino de validacion
 * para ambos modos.
 */
export async function requestAiProposal(kind: AiAssistKind, prompt: string): Promise<unknown> {
  const res = await fetch(`/api/ai/propose-${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  const body = (await res.json().catch(() => null)) as { result?: unknown; error?: string } | null;

  if (!res.ok) {
    const message = body?.error ?? `La IA respondio con un error (HTTP ${res.status}).`;
    throw new Error(message);
  }
  if (!body || !('result' in body)) {
    throw new Error('La IA devolvio una respuesta con forma inesperada.');
  }
  return body.result;
}
