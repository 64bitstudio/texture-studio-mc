import type { RGBA } from './textureBuffer';

/** Convierte un hex `#rrggbb` a RGBA con alpha fijo en 255 (opaco). */
export function hexToRgba(hex: string, alpha = 255): RGBA {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.substring(0, 2), 16);
  const g = Number.parseInt(normalized.substring(2, 4), 16);
  const b = Number.parseInt(normalized.substring(4, 6), 16);
  return { r, g, b, a: alpha };
}

export interface PaletteSwatch {
  name: string;
  hex: string;
}

/**
 * Paleta predefinida "estilo Minecraft" (HU-5) -- set curado de tonos
 * comunes en texturas de mobs/bloques/terreno (hueso/piedra/madera/
 * tierra/etc.), no exhaustivo a proposito (ver ticket 002, "no
 * necesitas que sea exhaustiva").
 */
export const MINECRAFT_PALETTE: PaletteSwatch[] = [
  { name: 'Hueso', hex: '#e3dcc5' },
  { name: 'Piedra clara', hex: '#a8a8a8' },
  { name: 'Piedra oscura', hex: '#6e6e6e' },
  { name: 'Roble', hex: '#9c7748' },
  { name: 'Roble oscuro', hex: '#4a3728' },
  { name: 'Tierra', hex: '#6b4a2f' },
  { name: 'Pasto', hex: '#5a8a3c' },
  { name: 'Arena', hex: '#dcd0a0' },
  { name: 'Agua', hex: '#3b6ea5' },
  { name: 'Obsidiana', hex: '#1a1523' },
  { name: 'Hierro', hex: '#d8d8d8' },
  { name: 'Oro', hex: '#f6c94c' },
  { name: 'Redstone', hex: '#a11c11' },
  { name: 'Esmeralda', hex: '#2fa85a' },
  { name: 'Carbon', hex: '#2b2b2b' },
  { name: 'Lana blanca', hex: '#e9e9e9' },
];
