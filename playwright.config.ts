import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '.env.test'), override: true })

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
    }
  ],
  webServer: [
    {
      command: 'node src/app.js',
      cwd: 'backend',
      url: 'http://localhost:5000/health',
      env: {
        PORT: '5000',
        INTERNAL_PORT: '9100',
        CACHE_DRIVER: 'redis',
        QUEUE_DRIVER: 'postgres',
        START_WORKERS: 'true',
        FACE_DRIVER: 'off',
        FACE_VERIFIER_DRIVER: 'off',
        NODE_ENV: 'development',
        COOKIE_SECURE: 'false',
        E2E_PROFILE: 'prod-parity',
        FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173',
        JWT_SECRET: process.env.JWT_SECRET || 'supersecret_jwt_proctornet_production_key_32bytes',
        S3_BUCKET: process.env.S3_BUCKET || 'proctornet-storage',
        AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
        DATABASE_URL: process.env.DATABASE_URL || `postgresql://proctornet:${process.env.POSTGRES_PASSWORD || 'missing_password'}@127.0.0.1:5434/proctornet_e2e_test?schema=public`,
        DIRECT_URL: process.env.DIRECT_URL || `postgresql://proctornet:${process.env.POSTGRES_PASSWORD || 'missing_password'}@127.0.0.1:5434/proctornet_e2e_test?schema=public`,
        REDIS_URL: process.env.REDIS_URL || (process.env.REDIS_PASSWORD ? `redis://:${process.env.REDIS_PASSWORD}@127.0.0.1:6380` : 'redis://127.0.0.1:6380'),
        S3_MOCK: process.env.S3_MOCK || 'true',
        EXAM_CACHE_TTL_MS: process.env.EXAM_CACHE_TTL_MS || '0'
      },
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      command: 'npm run dev',
      cwd: 'frontend',
      url: 'http://localhost:5173',
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe'
    }
  ]
})
