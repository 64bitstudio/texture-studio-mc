// Espejo del contrato de `GET /api/base-assets/skeleton`
// (backend/src/types/baseAssets.ts). Sin paquete compartido en este
// ticket (fuera de alcance -- scaffold minimo, ver
// docs/ARQUITECTURA.md): la duplicacion de este tipo es deliberada y
// pequeña: si el contrato cambia, ambos archivos se actualizan juntos.

export interface BoxUvOrigin {
  x: number;
  y: number;
}

export interface SkeletonBoxPart {
  size: [number, number, number];
  position: [number, number, number];
  uv: BoxUvOrigin;
  mirrorX?: boolean;
}

export interface SkeletonGeometry {
  textureWidth: number;
  textureHeight: number;
  parts: {
    head: SkeletonBoxPart;
    body: SkeletonBoxPart;
    armRight: SkeletonBoxPart;
    armLeft: SkeletonBoxPart;
    legRight: SkeletonBoxPart;
    legLeft: SkeletonBoxPart;
  };
}

export interface SkeletonTexture {
  dataUrl: string;
  width: number;
  height: number;
  isPlaceholder: boolean;
}

export interface SkeletonBaseAssetsResponse {
  texture: SkeletonTexture;
  geometry: SkeletonGeometry;
}
