// Espejo del contrato de `GET /api/base-assets/:mobId`
// (backend/src/types/baseAssets.ts). Sin paquete compartido en este
// ticket (fuera de alcance -- scaffold minimo, ver
// docs/ARQUITECTURA.md): la duplicacion de este tipo es deliberada y
// pequeña: si el contrato cambia, ambos archivos se actualizan juntos.
//
// TICKET 018 -- renombrado `Skeleton*` -> `Mob*` (sin cambio de forma),
// espejando el mismo rename que el backend ya hizo en el ticket 016: la
// FORMA de estos tipos ya era 100% generica (cajas + UV cross, nada
// hardcodeado al Esqueleto), solo el nombre asumia un unico mob. Este
// archivo se habia quedado atras del backend porque el ticket 016
// explicitamente no tocaba frontend -- este ticket (selector de mob) es
// el primero que necesita que el frontend piense en "un mob cualquiera"
// en vez de "el Esqueleto", asi que es el momento correcto para
// ponerlo al dia. Puramente un rename de tipos TypeScript -- ningun
// cambio de contrato HTTP.

export interface BoxUvOrigin {
  x: number;
  y: number;
}

/** Nombres legibles de cada cara del "cross" UV (ticket 011) -- ver `backend/src/types/baseAssets.ts` para la convencion completa. */
export interface FaceLabels {
  front: string;
  back: string;
  top: string;
  bottom: string;
  left: string;
  right: string;
}

export interface MobBoxPart {
  size: [number, number, number];
  position: [number, number, number];
  uv: BoxUvOrigin;
  mirrorX?: boolean;
  faceLabels: FaceLabels;
}

export interface MobGeometry {
  textureWidth: number;
  textureHeight: number;
  parts: {
    head: MobBoxPart;
    body: MobBoxPart;
    armRight: MobBoxPart;
    armLeft: MobBoxPart;
    legRight: MobBoxPart;
    legLeft: MobBoxPart;
  };
}

export interface MobTexture {
  dataUrl: string;
  width: number;
  height: number;
  isPlaceholder: boolean;
}

export interface MobBaseAssetsResponse {
  texture: MobTexture;
  geometry: MobGeometry;
}
