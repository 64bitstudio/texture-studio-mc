import { Router } from 'express';

// GET /health -- healthcheck consumido por corePipeline (Jenkinsfile,
// healthPath/healthyPattern) y por el healthcheck de
// deploy/docker-compose.*.yml. Sin dependencias externas (no hay DB/
// cache en este proyecto) -- responder 200 ya certifica que el proceso
// Node esta arriba y sirviendo requests.
export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});
