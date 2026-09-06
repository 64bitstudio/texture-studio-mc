// Ticket 034 -- tema claro/oscuro. Solo se testea la parte que NO toca
// el DOM (`getTheme`/`nextTheme`) -- `setTheme`/`toggleTheme` aplican
// `document.documentElement.dataset.theme`, que se verifica en vivo
// (Claude in Chrome), no con un test unitario (mismo criterio que el
// resto del código que toca canvas/DOM en este proyecto, ver
// `vitest.config.ts`). Mismo mock minimo de `localStorage` que
// `projectStorage.spec.ts` (ver ese archivo para el porqué de
// `globalThis.localStorage`).

import { beforeEach, describe, expect, it } from 'vitest';
import { getTheme, nextTheme } from '../src/theme';

class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

beforeEach(() => {
  globalThis.localStorage = new MockStorage();
});

describe('getTheme', () => {
  it('devuelve "dark" (default) si nunca se guardo ninguna preferencia', () => {
    expect(getTheme()).toBe('dark');
  });

  it('devuelve la preferencia guardada si es un valor valido', () => {
    globalThis.localStorage.setItem('ts-theme', 'light');
    expect(getTheme()).toBe('light');
  });

  it('devuelve "dark" (default) si el valor guardado no es "light" ni "dark"', () => {
    globalThis.localStorage.setItem('ts-theme', 'sepia');
    expect(getTheme()).toBe('dark');
  });
});

describe('nextTheme', () => {
  it('de "dark" alterna a "light"', () => {
    expect(nextTheme('dark')).toBe('light');
  });

  it('de "light" alterna a "dark"', () => {
    expect(nextTheme('light')).toBe('dark');
  });
});
