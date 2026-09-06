import { describe, expect, it } from 'vitest';
import { PANEL_WIDTH_MAX, PANEL_WIDTH_MIN, clampPanelWidth } from '../src/panelWidth';

describe('clampPanelWidth', () => {
  it('recorta al rango [PANEL_WIDTH_MIN, PANEL_WIDTH_MAX]', () => {
    expect(clampPanelWidth(0)).toBe(PANEL_WIDTH_MIN);
    expect(clampPanelWidth(PANEL_WIDTH_MIN - 50)).toBe(PANEL_WIDTH_MIN);
    expect(clampPanelWidth(PANEL_WIDTH_MAX + 500)).toBe(PANEL_WIDTH_MAX);
  });

  it('deja pasar cualquier valor dentro de rango tal cual', () => {
    expect(clampPanelWidth(PANEL_WIDTH_MIN)).toBe(PANEL_WIDTH_MIN);
    expect(clampPanelWidth(PANEL_WIDTH_MAX)).toBe(PANEL_WIDTH_MAX);
    expect(clampPanelWidth(300)).toBe(300);
  });
});
