import { SKELETON_GEOMETRY } from '../geometry/skeletonGeometry.js';
import { ZOMBIE_GEOMETRY } from '../geometry/zombieGeometry.js';
import { SPIDER_GEOMETRY } from '../geometry/spiderGeometry.js';
import { CREEPER_GEOMETRY } from '../geometry/creeperGeometry.js';
import type { MobGeometry } from '../types/baseAssets.js';

// Registro central de mobs soportados (ticket 016 -- ver
// docs/definiciones/multi-mob-y-proyectos-guardados.md, "Diseño
// técnico"). Fuente única de verdad para:
// - `GET /api/mobs` (catalogo para el menu del frontend, ticket 018).
// - `GET /api/base-assets/:mobId` (textura + geometria de un mob).
//
// Diseñado para crecer SIN refactor: agregar el Zombie (ticket 017) fue
// solo (a) escribir `backend/src/geometry/zombieGeometry.ts` (ver ese
// archivo para la investigacion + verificacion ya hechas -- mismas 6
// cajas que el Esqueleto, solo cambia el grosor/posicion de
// brazos/piernas y el alto real de la textura, 64 no 32) y (b) agregar
// la entrada de abajo a `MOB_REGISTRY` -- ningun cambio a las rutas
// (`routes/mobs.ts`, `routes/baseAssets.ts`) ni al servicio de carga de
// textura (`services/mobTexture.ts`), que ya eran 100% genericos sobre
// `MobDefinition`, confirmando la prediccion del ticket 016.
//
// `MobId` ya es una union de cuatro literales ('skeleton' | 'zombie' |
// 'spider' | 'creeper') -- Araña (ticket 020) y Creeper (ticket 021)
// requirieron la forma generalizada de `MobGeometry.parts` (de 6 claves
// fijas a `Record<string, MobBoxPart>`, ver `backend/src/types/
// baseAssets.ts`, "Ticket 020") por tener anatomias distintas a un
// biped, pero `MobDefinition`/las rutas de abajo siguieron sin cambios
// para ambas, confirmando la prediccion del ticket 016 para esa parte.
// El ticket 016 dejo dicho que se ampliaria aqui cuando 017/020/021
// agregaran su entrada, sin tocar la forma de las
// rutas (asi fue: cero cambios a esos archivos en este ticket).
export type MobId = 'skeleton' | 'zombie' | 'spider' | 'creeper';

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
  zombie: {
    id: 'zombie',
    label: 'Zombie',
    geometry: ZOMBIE_GEOMETRY,
    vanillaAssetFileName: 'zombie.png',
  },
  spider: {
    id: 'spider',
    label: 'Araña',
    geometry: SPIDER_GEOMETRY,
    vanillaAssetFileName: 'spider.png',
  },
  creeper: {
    id: 'creeper',
    label: 'Creeper',
    geometry: CREEPER_GEOMETRY,
    vanillaAssetFileName: 'creeper.png',
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
