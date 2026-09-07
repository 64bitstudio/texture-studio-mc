// Conversiones de color puras (ticket 072, para `HsvColorPicker.tsx`) --
// sin React/DOM, mismo criterio de testabilidad que `textureBuffer.ts`/
// `symmetry.ts`. `hexToRgba`/`MINECRAFT_PALETTE` (RGB<->hex) ya vivían en
// `colors.ts` -- este módulo agrega la conversión HSV que faltaba (el
// selector de color anterior, ticket 002/026, usaba `<input
// type="color">` nativo, que no necesita descomponer el color en
// matiz/saturación/valor).

export interface HSV {
  /** Matiz, 0-360 grados. */
  h: number;
  /** Saturación, 0-1. */
  s: number;
  /** Valor (brillo), 0-1. */
  v: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** `#rgb`/`#rrggbb` (con o sin `#`) -> `{r,g,b}` 0-255. `null` si el formato no es reconocible -- nunca lanza (ver criterio de "nunca fallo silencioso sin loguear" del resto de la app: el llamador decide qué hacer con `null`, ej. ignorar la escritura). */
export function hexToRgb(hex: string): RGB | null {
  const normalized = hex.trim().replace(/^#/, '');
  const expanded = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
  return {
    r: Number.parseInt(expanded.substring(0, 2), 16),
    g: Number.parseInt(expanded.substring(2, 4), 16),
    b: Number.parseInt(expanded.substring(4, 6), 16),
  };
}

/** `{r,g,b}` 0-255 -> `#rrggbb` minúsculas. */
export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** RGB (0-255 por canal) -> HSV. Fórmula estándar (ver cualquier referencia de conversión de color). */
export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
}

/** HSV -> RGB (0-255 por canal). Fórmula estándar. */
export function hsvToRgb({ h, s, v }: HSV): RGB {
  const c = v * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else if (hp <= 6) [r1, g1, b1] = [c, 0, x];
  const m = v - c;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

/** `#rrggbb` -> HSV. Cae en negro (`{h:0,s:0,v:0}`) si el hex no es válido -- mismo criterio de "nunca romper el render" que el resto de conversiones visuales de la app. */
export function hexToHsv(hex: string): HSV {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, v: 0 };
  return rgbToHsv(rgb);
}

/** HSV -> `#rrggbb`. */
export function hsvToHex(hsv: HSV): string {
  return rgbToHex(hsvToRgb(hsv));
}
