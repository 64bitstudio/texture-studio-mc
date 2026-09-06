/**
 * Navegación por teclado de un menú (ticket 025, usado por `Menu.tsx`).
 * Extraído como función pura -- mismo criterio de testabilidad que
 * `textureBuffer.ts`/`symmetry.ts` (ver `frontend/test/menuNavigation.spec.ts`)
 * en vez de probar el comportamiento de teclado a través del DOM
 * (environment `node`, sin jsdom -- ver `docs/ARQUITECTURA.md`, "Ticket
 * 025").
 *
 * `currentIndex` es `-1` cuando ningún item tiene foco todavía (recién
 * abierto el menú) -- `'ArrowDown'` desde ahí selecciona el primero,
 * `'ArrowUp'` selecciona el último (mismo patrón de menús nativos tipo
 * `<select>`/menús de sistema operativo).
 */
export type MenuNavigationKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

export function getNextMenuItemIndex(currentIndex: number, key: MenuNavigationKey, itemCount: number): number {
  if (itemCount <= 0) return -1;

  switch (key) {
    case 'Home':
      return 0;
    case 'End':
      return itemCount - 1;
    case 'ArrowDown':
      return currentIndex < 0 ? 0 : (currentIndex + 1) % itemCount;
    case 'ArrowUp':
      return currentIndex < 0 ? itemCount - 1 : (currentIndex - 1 + itemCount) % itemCount;
  }
}
