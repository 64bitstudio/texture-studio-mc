import type { MobSummary } from '../types/mobs';
import { Button } from '../ui';

export interface MobSelectorProps {
  mobs: MobSummary[];
  selectedMobId: string;
  onSelect: (mobId: string) => void;
}

/**
 * Menu de seleccion de mob (ticket 018, HU-1/HU-2). Deliberadamente
 * generico -- recibe el catalogo YA resuelto de `GET /api/mobs` y solo
 * renderiza lo que ese catalogo contenga, sin ningun mob hardcodeado
 * aca.
 *
 * `role="radiogroup"` + `aria-pressed` en cada boton -- un solo mob
 * puede estar activo a la vez.
 *
 * Ticket 026: migrado a `Button` (`ui/`) -- el mob activo usa
 * `variant="primary"`, el resto `variant="secondary"` (mapeo directo
 * del estado `isActive` que ya existia, sin variante nueva).
 */
export function MobSelector({ mobs, selectedMobId, onSelect }: MobSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Selector de mob" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {mobs.map((mob) => {
        const isActive = mob.id === selectedMobId;
        return (
          <Button
            key={mob.id}
            variant={isActive ? 'primary' : 'secondary'}
            role="radio"
            aria-checked={isActive}
            aria-pressed={isActive}
            onClick={() => onSelect(mob.id)}
          >
            {mob.label}
          </Button>
        );
      })}
    </div>
  );
}
