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
        NODE_ENV: 'production',
        COOKIE_SECURE: 'false',
        E2E_PROFILE: 'prod-parity',
        FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173',
        AGENT_PAIRING_PEPPER: process.env.AGENT_PAIRING_PEPPER || 'dummy_e2e_pairing_pepper_secret_32_characters_min',
        AGENT_POLICY_SIGNING_KEY: process.env.AGENT_POLICY_SIGNING_KEY || 'dummy_e2e_policy_signing_key_32_characters_min',
        ...(process.env.DATABASE_URL ? { DATABASE_URL: process.env.DATABASE_URL } : {}),
        ...(process.env.DIRECT_URL ? { DIRECT_URL: process.env.DIRECT_URL } : {}),
        ...(process.env.JWT_SECRET ? { JWT_SECRET: process.env.JWT_SECRET } : {}),
        ...(process.env.S3_BUCKET ? { S3_BUCKET: process.env.S3_BUCKET } : {}),
        ...(process.env.REDIS_URL ? { REDIS_URL: process.env.REDIS_URL } : {})
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
