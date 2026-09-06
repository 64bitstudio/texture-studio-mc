import { describe, expect, it } from 'vitest';
import { getNextMenuItemIndex } from '../src/ui/menuNavigation';

describe('getNextMenuItemIndex', () => {
  it('devuelve -1 si no hay items', () => {
    expect(getNextMenuItemIndex(-1, 'ArrowDown', 0)).toBe(-1);
  });

  it('ArrowDown desde -1 (recien abierto) selecciona el primero', () => {
    expect(getNextMenuItemIndex(-1, 'ArrowDown', 5)).toBe(0);
  });

  it('ArrowUp desde -1 (recien abierto) selecciona el ultimo', () => {
    expect(getNextMenuItemIndex(-1, 'ArrowUp', 5)).toBe(4);
  });

  it('ArrowDown avanza uno y da la vuelta (wrap) al llegar al final', () => {
    expect(getNextMenuItemIndex(0, 'ArrowDown', 3)).toBe(1);
    expect(getNextMenuItemIndex(2, 'ArrowDown', 3)).toBe(0);
  });

  it('ArrowUp retrocede uno y da la vuelta (wrap) al llegar al principio', () => {
    expect(getNextMenuItemIndex(1, 'ArrowUp', 3)).toBe(0);
    expect(getNextMenuItemIndex(0, 'ArrowUp', 3)).toBe(2);
  });

  it('Home siempre selecciona el primero, End siempre el ultimo', () => {
    expect(getNextMenuItemIndex(2, 'Home', 5)).toBe(0);
    expect(getNextMenuItemIndex(2, 'End', 5)).toBe(4);
  });
});
