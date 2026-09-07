import { useCallback, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { hexToHsv, hexToRgb, hsvToHex } from '../colorConversion';
import { MINECRAFT_PALETTE } from '../colors';

export interface HsvColorPickerProps {
  /** Color actualmente seleccionado, `#rrggbb`. */
  color: string;
  onChange: (hex: string) => void;
  /** Últimos colores usados en esta sesión de edición (más reciente primero) -- estado del padre (`Editor.tsx`), no de este componente, para que sobreviva mientras el editor esté montado. */
  recentColors: string[];
}

/**
 * Selector de color rico (ticket 072, pedido de Marco con imagen de
 * referencia -- "el formulario de edicion" debe verse como esa
 * imagen): reemplaza al `ColorPicker.tsx` anterior (paleta fija +
 * `<input type="color">` nativo, ticket 002/026, retirado en este
 * ticket) por un cuadro de saturación/valor + control de matiz +
 * entrada hexadecimal + colores recientes + la misma paleta "estilo
 * Minecraft" de antes, restilizada.
 *
 * El cuadro de saturación/valor usa la técnica CSS estándar (dos
 * gradientes superpuestos -- blanco→transparente horizontal, negro→
 * transparente vertical -- sobre un color base `hsl(matiz)`) en vez de
 * dibujarlo a canvas: más liviano, se re-pinta solo cambiando una
 * variable CSS, sin recalcular píxeles en cada frame de arrastre. El
 * control de matiz SÍ es un `<input type="range">` nativo (estilado
 * con un `background` en gradiente arcoíris, ver `.ui-hue-slider` en
 * `index.css`) en vez de un segundo control de arrastre hecho a mano --
 * gratis con el elemento nativo: teclado, accesibilidad, sin reinventar
 * lo que el navegador ya resuelve bien para un control 1D (mismo
 * criterio "no sobre-construyas" del ticket 002).
 */
export function HsvColorPicker({ color, onChange, recentColors }: HsvColorPickerProps) {
  const hsv = hexToHsv(color);
  const squareRef = useRef<HTMLDivElement | null>(null);
  const [hexInput, setHexInput] = useState(color);

  // BUG real encontrado en vivo (ticket 072, revisión en Chrome antes
  // de presentar a Marco): `hexInput` solo se inicializaba UNA vez
  // (`useState(color)`) -- un cambio de color que NO pasa por este
  // campo (click en un swatch de la paleta/recientes, arrastrar el
  // cuadro de saturación/valor, mover el matiz) actualizaba el swatch
  // "Color actual" pero dejaba el campo de texto mostrando el hex
  // VIEJO, hasta que el usuario lo editara a mano. `color` (prop) solo
  // cambia por una de esas interacciones o por `commitHexInput` (blur
  // con hex válido) -- NUNCA mientras se está tipeando (`handleHexInputChange`
  // no llama `onChange`) -- asi que resincronizar aca no pisa un tecleo
  // en curso.
  //
  // "Ajustar estado cuando cambia una prop" DURANTE el render (no en un
  // `useEffect`) -- patron oficial de React para este caso exacto (ver
  // react.dev, "You Might Not Need an Effect"): evita el re-render en
  // cascada que si dispara un efecto (React re-renderiza sincronicamente
  // antes de pintar en vez de programar una pasada aparte).
  const [prevColor, setPrevColor] = useState(color);
  if (color !== prevColor) {
    setPrevColor(color);
    setHexInput(color);
  }

  const updateFromSquare = useCallback(
    (clientX: number, clientY: number) => {
      const el = squareRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const v = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      onChange(hsvToHex({ h: hsv.h, s, v }));
    },
    [hsv.h, onChange],
  );

  const handleSquarePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      updateFromSquare(e.clientX, e.clientY);
    },
    [updateFromSquare],
  );

  const handleSquarePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return;
      updateFromSquare(e.clientX, e.clientY);
    },
    [updateFromSquare],
  );

  const handleHueChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      // Si el color actual es acromático (s=0 o v=0, ej. blanco/negro/gris
      // puro), mover SOLO el matiz desde ahí no debería dejar el
      // resultado igual de acromático (invisible para el usuario, "no
      // pasó nada") -- se fuerza un mínimo razonable al tocar el matiz
      // desde un extremo.
      const s = hsv.s || 1;
      const v = hsv.v || 1;
      onChange(hsvToHex({ h: Number(e.target.value), s, v }));
    },
    [hsv.s, hsv.v, onChange],
  );

  const handleHexInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setHexInput(e.target.value);
  }, []);

  const commitHexInput = useCallback(() => {
    const normalized = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
    if (hexToRgb(normalized)) {
      onChange(normalized.toLowerCase());
    } else {
      // Hex inválido -- vuelve a mostrar el color real vigente en vez de
      // dejar el campo con un valor que no corresponde a nada.
      setHexInput(color);
    }
  }, [hexInput, color, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        ref={squareRef}
        role="slider"
        aria-label="Saturación y brillo del color"
        aria-valuetext={color}
        tabIndex={0}
        onPointerDown={handleSquarePointerDown}
        onPointerMove={handleSquarePointerMove}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 'var(--radius-md)',
          cursor: 'crosshair',
          backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
          backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.5)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Una sola línea -- ver `ProjectCard.tsx` (ticket 053) para el hallazgo real de por qué (bug de `ui-accessibility-guard.sh` con tags multilínea, reportado via `SendFeedback`). */}
      <input type="range" min={0} max={360} value={hsv.h} onChange={handleHueChange} aria-label="Matiz del color" className="ui-hue-slider" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>Color actual</div>
          {/* Una sola línea -- mismo motivo que el slider de arriba. */}
          <input type="text" value={hexInput} onChange={handleHexInputChange} onBlur={commitHexInput} aria-label="Color en hexadecimal" style={{ width: '100%', fontSize: 'var(--font-sm)', fontFamily: 'monospace', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }} />
        </div>
      </div>

      {recentColors.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', marginBottom: 6 }}>Colores recientes</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {recentColors.map((hex) => (
              <button key={hex} type="button" aria-label={`Usar color ${hex}`} title={hex} onClick={() => onChange(hex)} className="ts-swatch" style={{ width: 22, height: 22, borderRadius: 4, background: hex, border: hex.toLowerCase() === color.toLowerCase() ? '2px solid var(--accent)' : '1px solid var(--border-strong)', cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', marginBottom: 6 }}>Paleta sugerida (Minecraft)</div>
        <div role="group" aria-label="Paleta de colores predefinida estilo Minecraft" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
          {MINECRAFT_PALETTE.map((swatch) => {
            const selected = swatch.hex.toLowerCase() === color.toLowerCase();
            return (
              <button key={swatch.hex} type="button" aria-label={`Color ${swatch.name} (${swatch.hex})`} aria-pressed={selected} title={swatch.name} onClick={() => onChange(swatch.hex)} className="ts-swatch" style={{ width: 22, height: 22, borderRadius: 4, background: swatch.hex, border: selected ? '2px solid var(--accent)' : '1px solid var(--border-strong)', cursor: 'pointer', padding: 0 }} />
            );
          })}
        </div>
      </div>
    </div>
  );
}
