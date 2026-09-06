import { groupDisplayLabel } from '../partIsolation';
import type { NamedUVRegion } from '../regionLabels';

export interface PartIsolationControlsProps {
  /** Catalogo completo de regiones nombradas (ticket 011), ya escalado a la resolucion activa. */
  regions: NamedUVRegion[];
  /** Id de la region actualmente aislada, o `null` en modo "Mostrar todo". */
  activeRegionId: string | null;
  onSelect: (regionId: string | null) => void;
}

/** Valor del `<option>` de "Mostrar todo" -- el `<select>` no admite `null` como `value`. */
const SHOW_ALL_VALUE = '';

/**
 * Selector de partes para aislar (ticket 012). Reusa DIRECTAMENTE el
 * catalogo de `regionLabels.ts` (`NamedUVRegion[]`, ya calculado por
 * `Editor.tsx`) -- no redefine nombres ni rectangulos propios, tal como
 * exige el ticket.
 *
 * DECISION: se aisla a nivel de REGION individual (una cara, ej.
 * "Cara"/"Pecho"/"Brazo — Lateral"), no a nivel de caja completa -- ver
 * `partIsolation.ts` para la justificacion completa. El `<select>`
 * agrupa las regiones por `groupKey` en `<optgroup>` (Cabeza/Torso/
 * Brazo/Pierna) unicamente para que la lista de 24 opciones sea
 * navegable, sin alterar el catalogo en si.
 *
 * "Mostrar todo" (criterio 4 del ticket) esta disponible de DOS formas
 * redundantes a proposito: como primera opcion del propio `<select>`
 * (para volver sin abrir ningun otro control) y como boton dedicado que
 * solo aparece con aislamiento activo (mas visible/rapido que reabrir el
 * dropdown y buscar la primera opcion) -- ninguna reemplaza a la otra,
 * el ticket pedia "boton/opcion" (cualquiera de las dos), se ofrecen
 * ambas por ser de costo minimo y no introducir un segundo mecanismo de
 * estado.
 */
export function PartIsolationControls({ regions, activeRegionId, onSelect }: PartIsolationControlsProps) {
  const groupOrder: string[] = [];
  const byGroup = new Map<string, NamedUVRegion[]>();
  for (const region of regions) {
    if (!byGroup.has(region.groupKey)) {
      byGroup.set(region.groupKey, []);
      groupOrder.push(region.groupKey);
    }
    byGroup.get(region.groupKey)!.push(region);
  }

  const activeRegion = activeRegionId ? (regions.find((r) => r.id === activeRegionId) ?? null) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor="part-isolation-select" style={{ fontSize: 13, flexShrink: 0 }}>
          Parte:
        </label>
        <select
          id="part-isolation-select"
          value={activeRegionId ?? SHOW_ALL_VALUE}
          onChange={(e) => onSelect(e.target.value === SHOW_ALL_VALUE ? null : e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            padding: '4px 6px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'var(--panel-bg)',
            color: 'var(--text)',
          }}
        >
          <option value={SHOW_ALL_VALUE}>Mostrar todo</option>
          {groupOrder.map((groupKey) => (
            <optgroup key={groupKey} label={groupDisplayLabel(groupKey)}>
              {byGroup.get(groupKey)!.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {activeRegion && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          style={{
            alignSelf: 'flex-start',
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'var(--panel-bg)',
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          Mostrar todo
        </button>
      )}
    </div>
  );
}
