// Miniaturas oficiales por mob + descripción corta (ticket 046, "Nuevo
// proyecto") -- decisión explícita de Marco tras pregunta directa: en
// vez de renderizar una miniatura 3D en vivo por mob (4 escenas WebGL
// simultáneas, trabajo nuevo real) o inventar un ícono genérico, se
// buscaron los renders OFICIALES de cada mob (Minecraft Wiki, mismo
// render que usa la wiki en el infobox de cada entidad -- ángulo/estilo
// consistente entre los 4) y se descargaron una sola vez como assets
// estáticos (`assets/mob-icons/`, importados por Vite -- quedan
// hasheados/optimizados en el build igual que cualquier otro asset).
//
// Contenido PURAMENTE presentacional del frontend -- no viene de
// `GET /api/mobs` (`MobSummary` solo tiene `id`/`label`, ver
// `types/mobs.ts`) ni de ningún otro endpoint; mismo criterio ya
// establecido por `DEFAULT_PACK_DESCRIPTION` (`exportPack.ts`): texto
// fijo mantenido en el frontend, no una fuente de verdad del backend.
// `MOB_ICONS`/`MOB_DESCRIPTIONS` son `Record<string, ...>` (no
// `Record<MobId, ...>`) a propósito -- este módulo no importa el tipo
// `MobId` del backend (`MobSummary.id` ya es `string` sin más, ver
// `types/mobs.ts`), así que el llamador siempre debe indexar con `??`/
// fallback por si el catálogo alguna vez trae un mob sin entrada aquí
// (ej. un mob nuevo agregado al backend antes de actualizar este
// archivo) -- nunca debe romper el render, solo mostrar sin miniatura.

import creeperIcon from './assets/mob-icons/creeper.png';
import skeletonIcon from './assets/mob-icons/skeleton.png';
import zombieIcon from './assets/mob-icons/zombie.png';
import spiderIcon from './assets/mob-icons/spider.png';

export const MOB_ICONS: Record<string, string> = {
  creeper: creeperIcon,
  skeleton: skeletonIcon,
  zombie: zombieIcon,
  spider: spiderIcon,
};

export const MOB_DESCRIPTIONS: Record<string, string> = {
  creeper: 'Explota al acercarse al jugador.',
  skeleton: 'Ataca a distancia con arco y flecha.',
  zombie: 'Persigue al jugador de cerca al anochecer.',
  spider: 'Trepa muros y ataca en la oscuridad.',
};
