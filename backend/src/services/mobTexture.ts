import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { generatePlaceholderMobTexturePng } from './placeholderTexture.js';
import type { MobDefinition } from '../mobs/registry.js';

export interface LoadedMobTexture {
  buffer: Buffer;
  isPlaceholder: boolean;
}

// Directorio NO versionado (ver .gitignore raiz, "vanilla-assets/") desde
// donde se sirve la textura vanilla real de cada mob, poblado por Marco
// a partir de un client .jar legitimo (ver ticket 007). Default pensado
// para funcionar tanto en dev local (backend/vanilla-assets/, vacio ->
// placeholder) como en el contenedor de despliegue (WORKDIR /app ->
// /app/vanilla-assets/, con un volumen de host montado ahi por
// docker-compose.*.yml). Resuelto en cada llamada (no una constante de
// modulo) para que sea configurable en tests sin reiniciar el proceso.
function resolveVanillaAssetsDir(): string {
  return process.env.VANILLA_ASSETS_DIR ?? path.resolve(process.cwd(), 'vanilla-assets');
}

/**
 * Carga la textura base de un mob (ticket 016 -- generaliza
 * `loadSkeletonTexture` del ticket 001 a cualquier entrada de
 * `MOB_REGISTRY`). Nunca falla ni lanza: si el archivo vanilla real
 * (`vanilla-assets/<mob.vanillaAssetFileName>`) no existe todavia o no
 * se puede leer por cualquier motivo, cae automaticamente al
 * placeholder procedural del tamaño correcto para ESE mob
 * (`mob.geometry.textureWidth/Height`) -- mismo requisito explicito del
 * ticket 001 ("el backend debe generar/servir automaticamente el
 * placeholder como fallback, nunca fallar con error"), ahora aplicado
 * por igual a cualquier mob del registro, no solo al Esqueleto.
 */
export async function loadMobTexture(mob: MobDefinition): Promise<LoadedMobTexture> {
  const texturePath = path.join(resolveVanillaAssetsDir(), mob.vanillaAssetFileName);
  try {
    const buffer = await readFile(texturePath);
    return { buffer, isPlaceholder: false };
  } catch {
    // No PII aqui -- solo una ruta de archivo local del propio despliegue.
    console.warn(
      `[base-assets] No se encontro (o no se pudo leer) la textura vanilla real de "${mob.id}" en "${texturePath}" -- sirviendo placeholder procedural (ver ticket 007).`,
    );
    return {
      buffer: generatePlaceholderMobTexturePng(mob.geometry.textureWidth, mob.geometry.textureHeight),
      isPlaceholder: true,
    };
  }
}
