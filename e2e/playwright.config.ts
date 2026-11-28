import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:49200',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // In CI, the Docker stack is managed by the workflow.
  // Locally, run `docker compose up` before `pnpm test:e2e`.
  webServer: process.env.CI
    ? undefined
    : {
        command: 'docker compose -f ../infrastructure/docker/docker-compose.yml -f ../infrastructure/docker/docker-compose.test.yml up --build -d',
        url: 'http://localhost:49200',
        timeout: 120_000,
        reuseExistingServer: true,
        cwd: __dirname,
      },
})
