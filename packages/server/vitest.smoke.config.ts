import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.smoke.test.ts'],
    testTimeout: 60_000,
  },
});
