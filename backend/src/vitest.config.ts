/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/__tests__/**'],
      },
      setupFiles: [],
      // Mock external dependencies
      mockReset: true,
      // Database config for tests
      env: {
        ...env,
        NODE_ENV: 'test',
        DB_NAME: 'async_hub_test',
      },
    },
  };
});
