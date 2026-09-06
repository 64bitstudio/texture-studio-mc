import { Router } from 'express';
import { getMobDefinition } from '../mobs/registry.js';
import { loadMobTexture } from '../services/mobTexture.js';
import type { MobBaseAssetsResponse } from '../types/baseAssets.js';

// GET /api/base-assets/:mobId (ticket 016 -- generaliza el endpoint del
// ticket 001, que era literal a `/api/base-assets/skeleton`) -- ver
// docs/API.md para el contrato completo. Un solo endpoint devuelve la
// textura (como data URL base64, real o placeholder -- ver
// docs/ARQUITECTURA.md) y la definicion de geometria/UV de las cajas
// del mob solicitado, para que el frontend pueda construir el visor 3D
// sin una segunda request.
//
// Ruta parametrizada, no dos rutas separadas: Express hace match de
// `/api/base-assets/skeleton` contra `:mobId = 'skeleton'` igual que
// contra cualquier otro id futuro (`zombie`, `spider`, ...) -- el
// contrato de respuesta para `skeleton` es EXACTAMENTE el mismo que
// antes de este ticket (mismos campos, mismos valores), asi que el
// frontend (que hoy sigue pidiendo literalmente `/api/base-assets/
// skeleton`, ver ticket 018 para su migracion a `/api/mobs` + selector)
// sigue funcionando sin ningun cambio ni ruta duplicada -- ver
// docs/ARQUITECTURA.md, "Ticket 016", para el detalle de esta decision.
export const baseAssetsRouter = Router();

baseAssetsRouter.get('/api/base-assets/:mobId', async (req, res) => {
  const { mobId } = req.params;
  const mob = getMobDefinition(mobId);

  if (!mob) {
    res.status(404).json({ error: `El mob "${mobId}" no existe. Ver GET /api/mobs para el catalogo disponible.` });
    return;
  }

  const { buffer, isPlaceholder } = await loadMobTexture(mob);

  const body: MobBaseAssetsResponse = {
    texture: {
      dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
      width: mob.geometry.textureWidth,
      height: mob.geometry.textureHeight,
      isPlaceholder,
    },
    geometry: mob.geometry,
  };

  res.status(200).json(body);
});
