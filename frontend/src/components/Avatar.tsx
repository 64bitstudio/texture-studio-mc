import { getAvatarInitial } from '../userPrefs';

export interface AvatarProps {
  displayName: string;
}

/**
 * Círculo con la inicial del nombre local (ticket 036, HU-6) -- SOLO
 * cosmético, sin cuenta real (ver `userPrefs.ts`). `displayName` viene
 * de `App.tsx` (estado levantado, único punto que lo guarda vía
 * `setUserPrefs` en `Settings.tsx`) para que este componente se
 * actualice de inmediato al guardar un nombre nuevo, sin releer
 * `localStorage` por su cuenta ni necesitar un mecanismo de eventos.
 *
 * Ticket 046: 40px (antes 28px) -- misma altura que los botones
 * ícono-cuadrado (`.ui-button--icon-square`) que ahora lo acompañan en
 * la topbar, para que los 3 controles queden alineados visualmente
 * (mockup de referencia). Ya NO está envuelto en un `<button>` que
 * abría Configuración (`AppShell.tsx`, ver ese archivo) -- vuelve a
 * ser puramente decorativo, sin ningún cambio de comportamiento propio
 * aquí.
 */
export function Avatar({ displayName }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      title={displayName}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: '50%',
        // Ticket 046, revisión 2: degradado (antes verde plano) --
        // confirmado contra la referencia con muestreo de píxeles, el
        // avatar va de `--accent` (arriba-izquierda) a un verde oliva
        // apagado (abajo-derecha), no un solo color sólido.
        background: 'linear-gradient(135deg, var(--accent), #6b7c4a)',
        color: '#0f171d',
        fontSize: 15,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {getAvatarInitial(displayName)}
    </span>
  );
}
