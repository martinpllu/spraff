import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    video: 'retain-on-failure',

    // Enable permissions for microphone
    permissions: ['microphone'],

    // Use fake audio device for testing
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run local server before starting tests
  webServer: {
    command: 'python3 -m http.server 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },
});
