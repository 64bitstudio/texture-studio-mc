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
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'var(--accent)',
        color: '#1b1c22',
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {getAvatarInitial(displayName)}
    </span>
  );
}
