import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,     // 30s for integration tests hitting Postgres
    hookTimeout: 15000,
    include: ['src/__tests__/**/*.test.ts'],
    sequence: {
      shuffle: false,
      concurrent: false,
    },
    pool: 'forks',
    maxWorkers: 1,
    isolate: false,
    env: {
      META_API_TOKEN: '',
      META_PHONE_ID: '',
      META_VERIFY_TOKEN: 'MOCK_VERIFY_TOKEN'
    }
  },
});
