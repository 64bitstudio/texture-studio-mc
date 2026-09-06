import type { ChangeEvent } from 'react';
import { Button } from './Button';
import { Select } from './Select';
import { IconGridView, IconListView, IconSearch } from './icons';

export type ToggleLayout = 'grid' | 'list';

export interface SortOption {
  value: string;
  label: string;
}

export interface SearchSortToggleBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchAriaLabel: string;
  /** Sin opciones (o `undefined`) -- se omite el `<select>` de orden por completo, no un dropdown de una sola opción sin utilidad (ver `Proyecto.tsx`, que no tiene un orden real más allá de alfabético). */
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortAriaLabel?: string;
  layout: ToggleLayout;
  onLayoutChange: (layout: ToggleLayout) => void;
}

const activeToggleStyle = { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#0f171d' } as const;

/**
 * Barra de búsqueda + orden opcional + toggle grid/lista (ticket 057) --
 * extraída de `MisProyectos.tsx` (ticket 053, primer consumidor) para
 * que `Proyecto.tsx` (segundo consumidor, tarjetas de mob) reuse el
 * mismo control en vez de duplicar el JSX. El orden es OPCIONAL
 * (`sortOptions`) porque no todos los listados tienen un criterio de
 * orden real que valga la pena exponer (ver `sortOptions` arriba).
 */
export function SearchSortToggleBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  sortOptions,
  sortValue,
  onSortChange,
  sortAriaLabel,
  layout,
  onLayoutChange,
}: SearchSortToggleBarProps) {
  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    onSearchChange(e.target.value);
  }

  function handleSortChange(e: ChangeEvent<HTMLSelectElement>) {
    onSortChange?.(e.target.value);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative' }}>
        <IconSearch size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
        {/* Una sola línea -- ver `ProjectCard.tsx` (ticket 053) para el hallazgo real de por qué (bug de `ui-accessibility-guard.sh` con tags multilínea, reportado via `SendFeedback`). */}
        <input type="search" aria-label={searchAriaLabel} placeholder={searchPlaceholder} value={searchValue} onChange={handleSearchChange} style={{ fontSize: 13, padding: '9px 12px 9px 32px', width: 220, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)' }} />
      </div>

      {sortOptions && sortOptions.length > 0 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
          Ordenar por
          <Select value={sortValue} onChange={handleSortChange} aria-label={sortAriaLabel} style={{ fontSize: 13, padding: '8px 10px' }}>
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </label>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <Button variant="icon-square" onClick={() => onLayoutChange('grid')} aria-pressed={layout === 'grid'} title="Vista de cuadrícula" style={layout === 'grid' ? activeToggleStyle : undefined}>
          <IconGridView size={18} />
          <span className="sr-only">Vista de cuadrícula</span>
        </Button>
        <Button variant="icon-square" onClick={() => onLayoutChange('list')} aria-pressed={layout === 'list'} title="Vista de lista" style={layout === 'list' ? activeToggleStyle : undefined}>
          <IconListView size={18} />
          <span className="sr-only">Vista de lista</span>
        </Button>
      </div>
    </div>
  );
}
