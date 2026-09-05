import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { generatePlaceholderSkeletonTexturePng } from './placeholderTexture.js';

export interface LoadedSkeletonTexture {
  buffer: Buffer;
  isPlaceholder: boolean;
}

// Directorio NO versionado (ver .gitignore raiz, "vanilla-assets/") desde
// donde se sirve la textura vanilla real del Esqueleto, poblado por
// Marco a partir de un client .jar legitimo (ver ticket 007). Default
// pensado para funcionar tanto en dev local (backend/vanilla-assets/,
// vacio -> placeholder) como en el contenedor de despliegue (WORKDIR
// /app -> /app/vanilla-assets/, con un volumen de host montado ahi por
// docker-compose.*.yml). Resuelto en cada llamada (no una constante de
// modulo) para que sea configurable en tests sin reiniciar el proceso.
function resolveVanillaSkeletonTexturePath(): string {
  const dir = process.env.VANILLA_ASSETS_DIR ?? path.resolve(process.cwd(), 'vanilla-assets');
  return path.join(dir, 'skeleton.png');
}

/**
 * Carga la textura base del Esqueleto. Nunca falla ni lanza: si el
 * archivo real no existe todavia (Marco no ha corrido el ticket 007) o
 * no se puede leer por cualquier motivo, cae automaticamente al
 * placeholder procedural -- requisito explicito del ticket 001 ("el
 * backend debe generar/servir automaticamente el placeholder como
 * fallback, nunca fallar con error").
 */
export async function loadSkeletonTexture(): Promise<LoadedSkeletonTexture> {
  const texturePath = resolveVanillaSkeletonTexturePath();
  try {
    const buffer = await readFile(texturePath);
    return { buffer, isPlaceholder: false };
  } catch {
    // No PII aqui -- solo una ruta de archivo local del propio despliegue.
    console.warn(
      `[base-assets] No se encontro (o no se pudo leer) la textura vanilla real en "${texturePath}" -- sirviendo placeholder procedural (ver ticket 007).`,
    );
    return { buffer: generatePlaceholderSkeletonTexturePng(), isPlaceholder: true };
  }
}
