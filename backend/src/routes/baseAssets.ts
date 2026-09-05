import { Router } from 'express';
import { SKELETON_GEOMETRY } from '../geometry/skeletonGeometry.js';
import { loadSkeletonTexture } from '../services/skeletonTexture.js';
import type { SkeletonBaseAssetsResponse } from '../types/baseAssets.js';

// GET /api/base-assets/skeleton -- ver docs/API.md para el contrato
// completo. Un solo endpoint devuelve la textura (como data URL base64,
// real o placeholder -- ver docs/ARQUITECTURA.md) y la definicion de
// geometria/UV de las 6 cajas del modelo, para que el frontend pueda
// construir el visor 3D sin una segunda request.
export const baseAssetsRouter = Router();

baseAssetsRouter.get('/api/base-assets/skeleton', async (_req, res) => {
  const { buffer, isPlaceholder } = await loadSkeletonTexture();

  const body: SkeletonBaseAssetsResponse = {
    texture: {
      dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
      width: SKELETON_GEOMETRY.textureWidth,
      height: SKELETON_GEOMETRY.textureHeight,
      isPlaceholder,
    },
    geometry: SKELETON_GEOMETRY,
  };

  res.status(200).json(body);
});
