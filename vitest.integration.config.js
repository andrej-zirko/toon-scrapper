import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.js'],
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
