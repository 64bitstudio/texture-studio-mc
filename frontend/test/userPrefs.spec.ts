// Ticket 036 -- perfil local de usuario. Mismo mock minimo de
// `localStorage` que `theme.spec.ts`/`projectStorage.spec.ts`.

import { beforeEach, describe, expect, it } from 'vitest';
import { getAvatarInitial, getUserPrefs, setUserPrefs } from '../src/userPrefs';

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

describe('getUserPrefs / setUserPrefs', () => {
  it('devuelve el nombre por defecto "Usuario" si nunca se configuro nada', () => {
    expect(getUserPrefs()).toEqual({ displayName: 'Usuario' });
  });

  it('guarda y recupera el nombre configurado', () => {
    setUserPrefs({ displayName: 'Marco' });
    expect(getUserPrefs()).toEqual({ displayName: 'Marco' });
  });

  it('devuelve el default si el valor guardado esta corrupto (no es JSON valido)', () => {
    globalThis.localStorage.setItem('ts-user-prefs', 'no es json{{{');
    expect(getUserPrefs()).toEqual({ displayName: 'Usuario' });
  });

  it('devuelve el default si el valor guardado no tiene la forma esperada', () => {
    globalThis.localStorage.setItem('ts-user-prefs', JSON.stringify({ foo: 'bar' }));
    expect(getUserPrefs()).toEqual({ displayName: 'Usuario' });
  });
});

describe('getAvatarInitial', () => {
  it('devuelve la primera letra en mayuscula', () => {
    expect(getAvatarInitial('Marco')).toBe('M');
    expect(getAvatarInitial('ana')).toBe('A');
  });

  it('recorta espacios antes de tomar la primera letra', () => {
    expect(getAvatarInitial('  zoe')).toBe('Z');
  });

  it('devuelve cadena vacia si el nombre esta vacio o es solo espacios', () => {
    expect(getAvatarInitial('')).toBe('');
    expect(getAvatarInitial('   ')).toBe('');
  });
});
