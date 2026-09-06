import type { MobSummary } from '../types/mobs';
import { Button } from '../ui';

export interface MobSelectorProps {
  mobs: MobSummary[];
  selectedMobId: string;
  onSelect: (mobId: string) => void;
  /**
   * Control adicional "+ Agregar mob" al final de la lista (ticket 043,
   * HU-2) -- opcional para no romper ningún otro consumidor futuro de
   * este componente que no tenga noción de "proyecto". Navega al flujo
   * de selección múltiple (ticket 042) sin perder el trabajo en curso
   * -- el buffer del mob activo ya vive en `bufferCache` (ticket 018),
   * `Editor` simplemente se desmonta y lo recupera de ahí al volver.
   */
  onAddMob?: () => void;
}

/**
 * Menu de seleccion de mob (ticket 018, HU-1/HU-2). Deliberadamente
 * generico -- recibe el catalogo YA resuelto de `GET /api/mobs` y solo
 * renderiza lo que ese catalogo contenga, sin ningun mob hardcodeado
 * aca.
 *
 * Ticket 043: `App.tsx` es quien filtra `mobs` contra
 * `activeProject.mobIds` ANTES de pasarlo aca -- este componente sigue
 * sin saber nada de "proyecto", solo muestra lo que recibe (mismo
 * criterio "generico" del ticket 018).
 *
 * `role="radiogroup"` + `aria-pressed` en cada boton -- un solo mob
 * puede estar activo a la vez.
 *
 * Ticket 026: migrado a `Button` (`ui/`) -- el mob activo usa
 * `variant="primary"`, el resto `variant="secondary"` (mapeo directo
 * del estado `isActive` que ya existia, sin variante nueva).
 */
export function MobSelector({ mobs, selectedMobId, onSelect, onAddMob }: MobSelectorProps) {
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
      {onAddMob && (
        <Button variant="icon" title="Agregar otro mob a este proyecto" onClick={onAddMob}>
          <span aria-hidden="true">➕</span> Agregar mob
        </Button>
      )}
    </div>
  );
}
