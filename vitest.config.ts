import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Unit-tests voor pure logica (btw, UBL, sparen, varianten, i18n, ...).
 * Draaien met `npm test`. Geen netwerk en geen database: tests/setup.ts haalt
 * de geheime sleutels uit de omgeving, zodat geen module een echte client maakt.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
});
