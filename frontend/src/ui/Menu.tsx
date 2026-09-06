import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';
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
  /** Acciones planas tipo "menuitem" (patrón ARIA "menu" -- navegables con flechas/Home/End). Opcional: un menú puede llevar solo `children`. */
  items?: MenuItem[];
  /**
   * Contenido libre (ticket 031) para acciones que ya traen su propia UI
   * rica -- campos de archivo, listas, confirmaciones inline -- y que
   * por eso NO encajan en el patrón ARIA "menu" (pensado solo para
   * items de accion planos, no para campos de formulario ni listas). Se
   * renderiza en un contenedor aparte dentro del mismo desplegable,
   * después de `items` si los hay. A diferencia de un item (que cierra
   * el menú al elegirse), el contenido de `children` NO cierra el menú
   * por sí solo -- sigue abierto mientras se interactúa con un campo de
   * archivo o una confirmación, y se cierra igual que siempre con
   * Escape o click afuera.
   */
  children?: ReactNode;
  /**
   * Variant del `Button` disparador (ticket 053, aditivo -- default
   * `undefined` deja el comportamiento previo intacto, `Button` ya cae a
   * `'secondary'` por su propio default). Primer caso real: el menú "⋮"
   * de cada tarjeta de "Mis proyectos" necesita verse compacto
   * (`'icon-square'`, mismo variant que ya usa la topbar) en vez del
   * botón con borde/padding normal que usa "Archivo" en `Editor.tsx`.
   * `label` sigue siendo el único contenido -- si se pasa un ícono sin
   * texto visible, quien llama es responsable de incluir texto accesible
   * via `.sr-only` dentro de `label` (mismo criterio que
   * `.ui-button--icon-square`, ver `index.css`) para no romper la regla
   * de accesibilidad del ticket 032 ("nunca solo ícono, sin nombre
   * accesible").
   */
  triggerVariant?: ButtonProps['variant'];
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
export function Menu({ label, items = [], children, triggerVariant }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // `close`/`toggleOpen` resetean `activeIndex` en el mismo evento que
  // cierra el menu -- nunca en un efecto aparte que solo reaccione a
  // `open` (oxlint `react(set-state-in-effect)`, mismo criterio ya
  // establecido en `App.tsx`, ver ticket 018).
  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  // Ticket 031: el panel se mide y se "voltea" a anclaje derecho de
  // forma imperativa (manipulando `panelRef.current.style` directo, sin
  // pasar por estado de React) justo antes de abrirse -- un boton
  // disparador cerca del borde IZQUIERDO de la ventana (ej. "Proyecto")
  // necesita anclar el panel a la izquierda (default), pero uno cerca
  // del borde DERECHO (ej. "Archivo", dentro de una columna angosta del
  // grid del panel) lo saca de la pantalla si se ancla igual -- se
  // decide en runtime, no con un valor fijo, porque la posicion real
  // depende de donde termine cada boton en el layout (grid `auto-fit`,
  // ancho real de ventana), no de cual menu es. El panel SIEMPRE esta
  // montado (oculto con opacidad, no `display: none`), asi que ya tiene
  // geometria real para medir en cualquier momento -- no hace falta un
  // efecto aparte que reaccione a `open`.
  function toggleOpen() {
    setOpen((wasOpen) => {
      const willOpen = !wasOpen;
      if (willOpen) {
        const panel = panelRef.current;
        if (panel) {
          panel.style.left = '0';
          panel.style.right = 'auto';
          if (panel.getBoundingClientRect().right > window.innerWidth) {
            panel.style.left = 'auto';
            panel.style.right = '0';
          }
        }
      } else {
        setActiveIndex(-1);
      }
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
      <Button variant={triggerVariant} aria-haspopup="menu" aria-expanded={open} onClick={toggleOpen}>
        {label}
      </Button>
      <div className={`ui-menu__panel${open ? ' ui-menu__panel--open' : ''}`} aria-hidden={!open} ref={panelRef}>
        {items.length > 0 && (
          <div className="ui-menu__list" role="menu">
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
        )}
        {/* Contenido libre (ticket 031) -- NO usa role="menuitem": ver
            doc de `MenuProps.children` arriba. */}
        {children && <div className="ui-menu__content">{children}</div>}
      </div>
    </div>
  );
}
