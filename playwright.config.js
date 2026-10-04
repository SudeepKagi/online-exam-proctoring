const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true
  },
  projects: [
    {
      name: 'chrome',
      use: {
        channel: 'chrome',
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream'
          ]
        }
      }
    }
  ],
  webServer: [
    {
      command: 'node src/app.js',
      cwd: 'proctornet/backend',
      url: 'http://localhost:5000/health',
      timeout: 30000,
      reuseExistingServer: true
    },
    {
      command: 'npm run dev',
      cwd: 'proctornet/frontend',
      url: 'http://localhost:5173',
      timeout: 30000,
      reuseExistingServer: true
    }
  ]
})
