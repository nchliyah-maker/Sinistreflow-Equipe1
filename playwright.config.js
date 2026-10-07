const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.E2E_PORT || '3100';

module.exports = defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node src/index.js',
    url: `http://127.0.0.1:${PORT}/health`,
    env: { PORT, TZ: 'Europe/Paris' },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
