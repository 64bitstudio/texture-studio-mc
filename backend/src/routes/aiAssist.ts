import { Router } from 'express';
import { requestAiJsonProposal } from '../services/aiAssist.js';

// Ticket 087 -- 3 endpoints (geometria/color/animacion, Etapas 1/3/4 del
// epic de modelado 3D, ver docs/definiciones/
// modelado-3d-custom-y-generacion-con-ia.md), mismo mecanismo de proxy
// generico: el frontend arma el prompt completo (identico al que
// usaria el modo puente manual, ver `AIAssistProvider` en los tickets
// 088/089/091) y este backend solo lo reenvia a Gemini, resguardando la
// API key. Rutas separadas (no una sola generica con un `type` en el
// body) para poder diferenciar logging/rate-limiting por tipo mas
// adelante sin romper el contrato -- hoy las 3 se comportan identico.
export const aiAssistRouter = Router();

type MaybeHttpError = Error & { status?: unknown };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function errorHttpStatus(err: unknown): number {
  if (err instanceof Error && typeof (err as MaybeHttpError).status === 'number') {
    return (err as MaybeHttpError).status as number;
  }
  return 502;
}

function errorMessageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Error desconocido llamando a la IA.';
}

function registerProposalEndpoint(path: string): void {
  aiAssistRouter.post(path, async (req, res) => {
    const prompt = (req.body as { prompt?: unknown } | undefined)?.prompt;
    if (!isNonEmptyString(prompt)) {
      res.status(400).json({ error: 'El campo "prompt" es requerido y debe ser texto no vacio.' });
      return;
    }

    try {
      const result = await requestAiJsonProposal(prompt);
      res.status(200).json({ result });
    } catch (err) {
      // Log PRIMERO, antes de cualquier otra cosa -- visible en los
      // logs del servidor ademas de en la respuesta al cliente (un
      // fallo de la API externa es justo el tipo de cosa que Marco
      // necesita poder ver en los logs del despliegue).
      console.warn('[aiAssist] fallo llamando a la IA:', err);
      res.status(errorHttpStatus(err)).json({ error: errorMessageOf(err) });
    }
  });
}

registerProposalEndpoint('/api/ai/propose-geometry');
registerProposalEndpoint('/api/ai/propose-color');
registerProposalEndpoint('/api/ai/propose-animation');
