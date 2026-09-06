import { groupDisplayLabel } from '../partIsolation';
import type { NamedUVRegion } from '../regionLabels';
import { Button, FormField, Select } from '../ui';

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
 * `Editor.tsx`) -- ver docs/ARQUITECTURA.md, "Ticket 012", para la
 * decisión completa (aislar a nivel de región individual, no de caja
 * completa; "Mostrar todo" disponible como opción Y como botón).
 *
 * Ticket 026: migrado a `FormField`+`Select`+`Button` (`ui/`) -- mismo
 * comportamiento, el label pasa de estar al lado del select (fila) a
 * estar arriba (columna, mismo patrón que `ResolutionControls`) como
 * parte de unificar la estructura visual del panel.
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
      <FormField label="Parte">
        <Select
          value={activeRegionId ?? SHOW_ALL_VALUE}
          onChange={(e) => onSelect(e.target.value === SHOW_ALL_VALUE ? null : e.target.value)}
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
        </Select>
      </FormField>
      {activeRegion && (
        <Button onClick={() => onSelect(null)} style={{ alignSelf: 'flex-start' }}>
          Mostrar todo
        </Button>
      )}
    </div>
  );
}
