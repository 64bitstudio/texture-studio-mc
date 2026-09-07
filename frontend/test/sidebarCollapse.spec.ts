// Pedido de Marco: "haz que el sidebar pueda hacerse pequeno". Mismo
// criterio de test que `theme.spec.ts` (ver ese archivo para el porque
// del mock minimo de `localStorage`/`globalThis.localStorage`) -- solo
// se testea la lectura/escritura, `Sidebar.tsx` en si se verifica en
// vivo (Claude in Chrome), no con un test unitario.

import { beforeEach, describe, expect, it } from 'vitest';
import { getSidebarCollapsed, setSidebarCollapsed } from '../src/sidebarCollapse';

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

describe('getSidebarCollapsed', () => {
  it('devuelve false (default, expandido) si nunca se guardo ninguna preferencia', () => {
    expect(getSidebarCollapsed()).toBe(false);
  });

  it('devuelve la preferencia guardada cuando es "true"', () => {
    globalThis.localStorage.setItem('ts-sidebar-collapsed', 'true');
    expect(getSidebarCollapsed()).toBe(true);
  });

  it('devuelve la preferencia guardada cuando es "false"', () => {
    globalThis.localStorage.setItem('ts-sidebar-collapsed', 'false');
    expect(getSidebarCollapsed()).toBe(false);
  });

  it('devuelve false (default) si el valor guardado no es "true" ni "false"', () => {
    globalThis.localStorage.setItem('ts-sidebar-collapsed', 'sepia');
    expect(getSidebarCollapsed()).toBe(false);
  });
});

describe('setSidebarCollapsed', () => {
  it('guarda "true" cuando se colapsa', () => {
    setSidebarCollapsed(true);
    expect(globalThis.localStorage.getItem('ts-sidebar-collapsed')).toBe('true');
  });

  it('guarda "false" cuando se expande', () => {
    setSidebarCollapsed(false);
    expect(globalThis.localStorage.getItem('ts-sidebar-collapsed')).toBe('false');
  });

  it('round-trip: lo que se guarda es lo que despues se lee', () => {
    setSidebarCollapsed(true);
    expect(getSidebarCollapsed()).toBe(true);
  });
});
