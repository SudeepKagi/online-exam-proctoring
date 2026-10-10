import { defineConfig, devices } from '@playwright/test'
import path from 'path'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.spec.ts', '**/*.spec.js'],
  timeout: 90000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  retries: 0, // No flakiness masking for journeys
  workers: 1, // Deterministic sequential journeys
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/e2e/html', open: 'never' }],
    ['junit', { outputFile: 'reports/e2e/junit.xml' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: process.env.HEADED !== 'true',
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--auto-select-desktop-capture-source=Entire screen'
      ]
    }
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    },
    {
      name: 'chrome',
      use: {
        channel: 'chrome'
      }
    },
    {
      name: 'msedge',
      use: {
        channel: 'msedge'
      }
    }
  ],
  webServer: [
    {
      command: 'node src/app.js',
      cwd: 'proctornet/backend',
      url: 'http://localhost:5000/health',
      env: {
        PORT: '5000',
        INTERNAL_PORT: '9100',
        CACHE_DRIVER: 'memory',
        QUEUE_DRIVER: 'postgres',
        START_WORKERS: 'true',
        FACE_DRIVER: 'test',
        NODE_ENV: 'production'
      },
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      command: 'npm run dev',
      cwd: 'proctornet/frontend',
      url: 'http://localhost:5173',
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe'
    }
  ]
})
