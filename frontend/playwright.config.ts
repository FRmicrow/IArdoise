import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  // The backend only allows one active session per host username and never
  // frees it, so every project must run against a stateful server one test
  // at a time — parallel workers would race two projects over the same
  // singleton host session.
  workers: 1,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
});
