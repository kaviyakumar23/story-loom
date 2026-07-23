import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Points at PLAYWRIGHT_BASE_URL (default local dev). Read-only smoke
 * specs run against any environment; the full create→preview→edit flow needs a
 * seeded test environment (invite code, a test DB, and mocked AI) — see e2e/README.md.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
