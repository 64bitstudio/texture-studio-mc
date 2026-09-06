import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { getNextMenuItemIndex } from './menuNavigation';

export interface MenuItem {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  /** `true` deshabilita el item (ej. "Exportar" sin nada pintado todavia) -- se sigue mostrando, no se oculta. */
  disabled?: boolean;
}

export interface MenuProps {
  /** Texto del botón que abre el menú (ticket 032: siempre texto, nunca solo ícono). */
  label: ReactNode;
  items: MenuItem[];
}

/**
 * Menú desplegable accesible (ticket 025, usado por el menú "Archivo"
 * del ticket 031) -- patrón "disclosure": botón con `aria-expanded` +
 * lista con `role="menu"`, cierre con Escape o click fuera, navegación
 * con flechas/Home/End (`getNextMenuItemIndex`, pura y testeada aparte).
 * Sin librería externa -- el patrón es chico y ya se necesitaba el
 * mismo criterio de "sin dependencias nuevas si no hace falta" del
 * resto del proyecto.
 */
export function Menu({ label, items }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // `close`/`toggleOpen` resetean `activeIndex` en el mismo evento que
  // cierra el menu -- nunca en un efecto aparte que solo reaccione a
  // `open` (oxlint `react(set-state-in-effect)`, mismo criterio ya
  // establecido en `App.tsx`, ver ticket 018).
  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function toggleOpen() {
    setOpen((wasOpen) => {
      const willOpen = !wasOpen;
      if (!willOpen) setActiveIndex(-1);
      return willOpen;
    });
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        setActiveIndex((current) => getNextMenuItemIndex(current, e.key as 'ArrowDown' | 'ArrowUp' | 'Home' | 'End', items.length));
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, items.length]);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      itemRefs.current[activeIndex]?.focus();
    }
  }, [open, activeIndex]);

  return (
    <div className="ui-menu" ref={rootRef}>
      <Button aria-haspopup="menu" aria-expanded={open} onClick={toggleOpen}>
        {label}
      </Button>
      <div className={`ui-menu__list${open ? ' ui-menu__list--open' : ''}`} role="menu" aria-hidden={!open}>
        {items.map((item, index) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            className="ui-menu__item"
            disabled={item.disabled}
            tabIndex={open ? 0 : -1}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            onClick={() => {
              item.onSelect();
              close();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
