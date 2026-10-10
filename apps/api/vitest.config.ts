import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts'],
    exclude: ['**/quarantine/**', '**/node_modules/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
