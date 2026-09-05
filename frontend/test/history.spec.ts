import { describe, expect, it } from 'vitest';
import { PaintHistory } from '../src/history';

const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };
const RED = { r: 255, g: 0, b: 0, a: 255 };
const BLUE = { r: 0, g: 0, b: 255, a: 255 };

describe('PaintHistory', () => {
  it('arranca sin nada que deshacer ni rehacer', () => {
    const history = new PaintHistory();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });

  it('un trazo con cambios habilita undo tras cerrarlo (commitStroke)', () => {
    const history = new PaintHistory();
    history.beginStroke();
    history.recordChange(0, 0, TRANSPARENT, RED);
    // Todavia no se cerro el trazo -- no cuenta como historial apilado.
    expect(history.canUndo).toBe(false);
    history.commitStroke();
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it('un trazo sin ningun cambio (beginStroke seguido de commitStroke) no genera entrada de historial', () => {
    const history = new PaintHistory();
    history.beginStroke();
    history.commitStroke();
    expect(history.canUndo).toBe(false);
  });

  it('recordChange fuera de un trazo (sin beginStroke) es un no-op seguro', () => {
    const history = new PaintHistory();
    history.recordChange(0, 0, TRANSPARENT, RED);
    history.commitStroke();
    expect(history.canUndo).toBe(false);
  });

  it('undo devuelve el trazo completo y lo mueve al historial de redo', () => {
    const history = new PaintHistory();
    history.beginStroke();
    history.recordChange(0, 0, TRANSPARENT, RED);
    history.recordChange(1, 0, TRANSPARENT, RED);
    history.commitStroke();

    const stroke = history.undo();
    expect(stroke).toEqual([
      { x: 0, y: 0, before: TRANSPARENT, after: RED },
      { x: 1, y: 0, before: TRANSPARENT, after: RED },
    ]);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
  });

  it('redo despues de un undo devuelve el mismo trazo y lo vuelve a dejar en el historial de undo', () => {
    const history = new PaintHistory();
    history.beginStroke();
    history.recordChange(2, 2, TRANSPARENT, BLUE);
    history.commitStroke();

    const undone = history.undo();
    const redone = history.redo();
    expect(redone).toEqual(undone);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it('pintar un trazo nuevo tras un undo descarta el historial de redo (no acumula ramas)', () => {
    const history = new PaintHistory();

    history.beginStroke();
    history.recordChange(0, 0, TRANSPARENT, RED);
    history.commitStroke();

    history.undo();
    expect(history.canRedo).toBe(true);

    // Nuevo trazo despues del undo -- comportamiento estandar: el redo pendiente se descarta.
    history.beginStroke();
    history.recordChange(5, 5, TRANSPARENT, BLUE);
    history.commitStroke();

    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBeNull();
    expect(history.canUndo).toBe(true);
  });

  it('varios trazos se deshacen en orden inverso (LIFO), uno por llamada a undo', () => {
    const history = new PaintHistory();

    history.beginStroke();
    history.recordChange(0, 0, TRANSPARENT, RED);
    history.commitStroke();

    history.beginStroke();
    history.recordChange(1, 1, TRANSPARENT, BLUE);
    history.commitStroke();

    const firstUndo = history.undo();
    expect(firstUndo).toEqual([{ x: 1, y: 1, before: TRANSPARENT, after: BLUE }]);
    expect(history.canUndo).toBe(true);

    const secondUndo = history.undo();
    expect(secondUndo).toEqual([{ x: 0, y: 0, before: TRANSPARENT, after: RED }]);
    expect(history.canUndo).toBe(false);
  });

  it('si el mismo pixel se repinta varias veces dentro de un trazo, conserva el before original y el after final', () => {
    const history = new PaintHistory();
    history.beginStroke();
    history.recordChange(3, 3, TRANSPARENT, RED);
    // Mismo pixel, repintado dentro del mismo trazo (ej. arrastre que se autointersecta).
    history.recordChange(3, 3, RED, BLUE);
    history.commitStroke();

    const stroke = history.undo();
    expect(stroke).toEqual([{ x: 3, y: 3, before: TRANSPARENT, after: BLUE }]);
  });
});
