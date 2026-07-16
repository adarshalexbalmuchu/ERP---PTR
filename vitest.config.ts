import { defineConfig } from 'vitest/config';

// Deliberately separate from vite.config.ts — the PWA/manifest plugin setup
// there has nothing to do with running unit tests, and keeping this minimal
// avoids coupling the test runner to the app bundler's config surface.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
