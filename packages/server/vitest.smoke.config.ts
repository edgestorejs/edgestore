import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'vitest/config';

const smokeEnvFile = process.env.TEST_ENV
  ? `.env.smoke.${process.env.TEST_ENV}`
  : '.env.smoke.local';
const smokeEnvPath = resolve(__dirname, smokeEnvFile);

if (existsSync(smokeEnvPath)) {
  loadDotenv({
    path: smokeEnvPath,
    override: false,
  });
}

export default defineConfig({
  test: {
    fileParallelism: false,
    include: ['src/**/*.smoke.test.ts'],
    testTimeout: 60_000,
  },
});
