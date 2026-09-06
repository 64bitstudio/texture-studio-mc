import type { MobSummary } from '../types/mobs';

export interface MobSelectorProps {
  mobs: MobSummary[];
  selectedMobId: string;
  onSelect: (mobId: string) => void;
}

/**
 * Menu de seleccion de mob (ticket 018, HU-1/HU-2). Deliberadamente
 * generico -- recibe el catalogo YA resuelto de `GET /api/mobs`
 * (`App.tsx`) y solo renderiza lo que ese catalogo contenga, sin ningun
 * mob hardcodeado aca (hoy Esqueleto/Zombie; si el backend agrega
 * Araña/Creeper en un ticket futuro, este componente los muestra solo
 * porque el catalogo creció, sin tocar este archivo).
 *
 * `role="radiogroup"` + `aria-pressed` en cada boton (mismo patron de
 * "grupo de opciones exclusivas" ya usado por `ColorPicker` para la
 * paleta de swatches) -- un solo mob puede estar activo a la vez, y el
 * boton activo lo señala visual y programaticamente sin depender solo
 * del color.
 */
export function MobSelector({ mobs, selectedMobId, onSelect }: MobSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Selector de mob" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {mobs.map((mob) => {
        const isActive = mob.id === selectedMobId;
        return (
          <button
            key={mob.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-pressed={isActive}
            onClick={() => onSelect(mob.id)}
            style={{
              fontSize: 13,
              padding: '6px 14px',
              borderRadius: 6,
              border: isActive ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.25)',
              background: isActive ? 'var(--accent)' : 'var(--panel-bg)',
              color: isActive ? '#1b1c22' : 'var(--text)',
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {mob.label}
          </button>
        );
      })}
    </div>
  );
}
