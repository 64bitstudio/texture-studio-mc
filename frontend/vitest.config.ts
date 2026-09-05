import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Solo se testea logica pura (TextureBuffer / bresenhamLine) --
    // no requiere DOM. Los componentes de canvas/three.js se validan
    // con revision visual en vivo (Claude in Chrome), ver ticket 002.
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
});
