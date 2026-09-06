import { SKELETON_GEOMETRY } from '../geometry/skeletonGeometry.js';
import type { MobGeometry } from '../types/baseAssets.js';

// Registro central de mobs soportados (ticket 016 -- ver
// docs/definiciones/multi-mob-y-proyectos-guardados.md, "Diseño
// técnico"). Fuente única de verdad para:
// - `GET /api/mobs` (catalogo para el menu del frontend, ticket 018).
// - `GET /api/base-assets/:mobId` (textura + geometria de un mob).
//
// Diseñado para crecer SIN refactor: agregar el Zombie (ticket 017) es
// solo (a) escribir `backend/src/geometry/zombieGeometry.ts` (ver ese
// archivo para la investigacion ya hecha -- mismas 6 cajas que el
// Esqueleto, solo cambia el grosor de brazos/piernas) y (b) agregar una
// entrada nueva a `MOB_REGISTRY` con su `id`/`label`/`geometry`/
// `vanillaAssetFileName` -- ningun cambio a este archivo mas alla de
// esas dos lineas, ni a las rutas (`routes/mobs.ts`,
// `routes/baseAssets.ts`) ni al servicio de carga de textura
// (`services/mobTexture.ts`), que ya son 100% genericos sobre
// `MobDefinition`.
//
// `MobId` es hoy un literal unico ('skeleton') a proposito -- el ticket
// 016 dice explicitamente que NO se agregan Zombie/Araña/Creeper todavia
// (eso es 017/020/021). Cuando esos tickets agreguen su entrada,
// `MobId` se amplia a una union (`'skeleton' | 'zombie' | ...`), sin
// tocar la forma de `MobDefinition` ni de las rutas.
export type MobId = 'skeleton';

export interface MobDefinition {
  id: MobId;
  /** Nombre legible (es-MX) para el menu del frontend (ticket 018). */
  label: string;
  geometry: MobGeometry;
  /**
   * Nombre del archivo del asset vanilla real dentro de
   * `vanilla-assets/` (ver ticket 007) -- ej. "skeleton.png". Si el
   * archivo no existe todavia en el despliegue, `loadMobTexture` cae
   * automaticamente al placeholder procedural (sin cambios de
   * comportamiento respecto al ticket 001/007).
   */
  vanillaAssetFileName: string;
}

export const MOB_REGISTRY: Record<MobId, MobDefinition> = {
  skeleton: {
    id: 'skeleton',
    label: 'Esqueleto',
    geometry: SKELETON_GEOMETRY,
    vanillaAssetFileName: 'skeleton.png',
  },
};

/** Busca un mob por id de forma segura (acepta cualquier string, ej. un `req.params.mobId` sin validar). */
export function getMobDefinition(mobId: string): MobDefinition | undefined {
  return (MOB_REGISTRY as Record<string, MobDefinition>)[mobId];
}

/** Catalogo para `GET /api/mobs` -- solo los campos que el menu del frontend necesita. */
export function listMobs(): Array<{ id: MobId; label: string }> {
  return Object.values(MOB_REGISTRY).map(({ id, label }) => ({ id, label }));
}
