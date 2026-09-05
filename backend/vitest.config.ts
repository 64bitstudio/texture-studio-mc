import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // lcov.info es lo que consume sonar.javascript.lcov.reportPaths (ver sonar-project.properties).
      reportsDirectory: './coverage',
      include: ['src/**'],
      // server.ts es solo el entrypoint (app.listen) -- se ejercita end
      // to end en runtime real, no vale la pena un test dedicado solo
      // para subir el numero de cobertura (mismo criterio que
      // mail-core-mc excluyendo src/main.ts).
      exclude: ['src/server.ts'],
    },
  },
});
