// PaintHistory -- historial de deshacer/rehacer sobre las escrituras de
// TextureBuffer (ticket 003, HU-4: ver
// docs/definiciones/editor-3d-texturas-esqueleto.md).
//
// Deliberadamente independiente de React/DOM/three.js -- igual que
// TextureBuffer, para poder testear la logica pura con Vitest sin
// jsdom (ver frontend/test/history.spec.ts). No conoce el buffer ni
// como pintar: solo guarda pares (before, after) por pixel y decide
// que stroke aplica un undo/redo; quien la usa (Editor.tsx) es
// responsable de leer el valor "antes" del buffer y de escribirlo de
// vuelta.
//
// Granularidad (decision de este ticket, no estaba especificada):
// un "trazo" completo -- desde pointerdown hasta pointerup/
// pointercancel -- es UNA unidad de historial, no cada pixel
// individual dentro del arrastre. Ver docs/ARQUITECTURA.md, seccion
// "Ticket 003", para la justificacion completa (UX esperada de
// cualquier editor de pixel art: un undo revierte un trazo, no un
// pixel a la vez).

import type { RGBA } from './textureBuffer';

export interface PixelChange {
  x: number;
  y: number;
  /** Color del pixel inmediatamente antes de que este trazo lo tocara por primera vez. */
  before: RGBA;
  /** Color del pixel al finalizar el trazo (la ULTIMA escritura, si se repinto mas de una vez). */
  after: RGBA;
}

/** Un trazo: el conjunto de cambios de pixel producidos entre un pointerdown y su pointerup/pointercancel. */
export type Stroke = PixelChange[];

export class PaintHistory {
  private undoStack: Stroke[] = [];
  private redoStack: Stroke[] = [];
  private pending: Map<string, PixelChange> | null = null;

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Inicia un trazo nuevo (pointerdown). Si ya habia un trazo pendiente
   * sin cerrar (no deberia pasar en uso normal -- significaria que
   * `commitStroke` no se llamo tras un trazo anterior), lo descarta en
   * silencio en vez de mezclarlo con el nuevo: nunca deja cambios de
   * dos trazos distintos apilados como si fueran uno solo.
   */
  beginStroke(): void {
    this.pending = new Map();
  }

  /**
   * Registra un cambio de pixel dentro del trazo en curso. Si el mismo
   * pixel se toca mas de una vez en el mismo trazo (ej. el arrastre se
   * autointersecta), conserva el `before` de la PRIMERA escritura de
   * este trazo y actualiza `after` a la ULTIMA -- asi deshacer el trazo
   * completo devuelve exactamente el estado anterior al trazo,
   * sin importar cuantas veces se repinto el mismo pixel dentro de el.
   *
   * No-op si no hay un trazo en curso (`beginStroke` no se llamo antes) --
   * defensivo, nunca lanza.
   */
  recordChange(x: number, y: number, before: RGBA, after: RGBA): void {
    if (!this.pending) return;
    const key = `${x},${y}`;
    const existing = this.pending.get(key);
    if (existing) {
      existing.after = after;
    } else {
      this.pending.set(key, { x, y, before, after });
    }
  }

  /**
   * Cierra el trazo en curso (pointerup/pointercancel). Si tuvo al
   * menos un cambio, lo apila en el historial de undo y DESCARTA por
   * completo el historial de redo (comportamiento estandar de
   * cualquier editor: pintar algo nuevo tras un undo invalida los
   * redos pendientes, no los deja acumulando ramas -- criterio
   * explicito del ticket 003). Un trazo sin cambios (ej. beginStroke
   * sin ningun recordChange) no genera una entrada vacia en el
   * historial de undo.
   */
  commitStroke(): void {
    const pending = this.pending;
    this.pending = null;
    if (!pending || pending.size === 0) return;
    this.undoStack.push(Array.from(pending.values()));
    this.redoStack = [];
  }

  /**
   * Deshace el ultimo trazo: lo mueve al historial de redo y devuelve
   * sus cambios para que el llamador aplique `before` a cada pixel
   * afectado. `null` si no hay nada que deshacer (`canUndo` es `false`).
   */
  undo(): Stroke | null {
    const stroke = this.undoStack.pop();
    if (!stroke) return null;
    this.redoStack.push(stroke);
    return stroke;
  }

  /**
   * Rehace el ultimo trazo deshecho: lo mueve de vuelta al historial de
   * undo y devuelve sus cambios para que el llamador aplique `after` a
   * cada pixel afectado. `null` si no hay nada que rehacer (`canRedo`
   * es `false`).
   */
  redo(): Stroke | null {
    const stroke = this.redoStack.pop();
    if (!stroke) return null;
    this.undoStack.push(stroke);
    return stroke;
  }
}
