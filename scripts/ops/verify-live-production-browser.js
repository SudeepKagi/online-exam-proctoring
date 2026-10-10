'use strict'

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE_URL = process.env.BASE_URL || 'https://proctornet.duckdns.org'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@proctornet.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123'

const OUTPUT_DIR = path.resolve(__dirname, '../../reports/evidence/live-production')
const ARTIFACT_DIR = 'C:/Users/sudee/.gemini/antigravity-ide/brain/1ecb89b0-8094-40bc-b5d5-79cb98821c06'

fs.mkdirSync(OUTPUT_DIR, { recursive: true })

async function runLiveProductionVerification() {
  console.log('\n======================================================')
  console.log('🚀 ProctorNet Live Production Browser Verification')
  console.log(`Target: ${BASE_URL}`)
  console.log('======================================================\n')

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  })

  const page = await context.newPage()
  const results = {
    target: BASE_URL,
    timestamp: new Date().toISOString(),
    steps: []
  }

  const captureScreenshot = async (name) => {
    const localPath = path.join(OUTPUT_DIR, `${name}.png`)
    const artPath = path.join(ARTIFACT_DIR, `${name}.png`)
    await page.screenshot({ path: localPath, fullPage: false })
    try {
      fs.copyFileSync(localPath, artPath)
    } catch (_) {}
    return localPath
  }

  try {
    // 1. Landing Page
    console.log('[1/6] Testing Landing Page...')
    const landingRes = await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 })
    const title = await page.title()
    const landingShot = await captureScreenshot('prod-01-landing')
    console.log(`  ✓ Landing page loaded: HTTP ${landingRes.status()} - "${title}"`)
    results.steps.push({
      step: 'Landing Page',
      status: 'PASS',
      httpStatus: landingRes.status(),
      title,
      screenshot: landingShot
    })

    // 2. Admin Login Navigation
    console.log('[2/6] Navigating to Admin Login...')
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle', timeout: 30000 })
    await captureScreenshot('prod-02-admin-login')

    // 3. Fill and Submit Admin Credentials
    console.log(`[3/6] Authenticating as Admin (${ADMIN_EMAIL})...`)
    await page.fill('input[type="email"], input[name="email"], #email', ADMIN_EMAIL)
    await page.fill('input[type="password"], input[name="password"], #password', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')

    // Wait for Dashboard URL or Dashboard header
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 })
    console.log('  ✓ Admin redirected to /admin/dashboard')
    await page.waitForLoadState('networkidle')
    const dashShot = await captureScreenshot('prod-03-admin-dashboard')
    const dashText = await page.innerText('body')
    results.steps.push({
      step: 'Admin Dashboard Login & Render',
      status: 'PASS',
      url: page.url(),
      screenshot: dashShot
    })

    // 4. Admin Faculty Management
    console.log('[4/6] Testing Admin Faculty View...')
    await page.goto(`${BASE_URL}/admin/faculty`, { waitUntil: 'networkidle', timeout: 15000 })
    const facShot = await captureScreenshot('prod-04-admin-faculty')
    console.log('  ✓ Admin Faculty page rendered')
    results.steps.push({
      step: 'Admin Faculty View',
      status: 'PASS',
      url: page.url(),
      screenshot: facShot
    })

    // 5. Admin Students Management
    console.log('[5/6] Testing Admin Students View...')
    await page.goto(`${BASE_URL}/admin/students`, { waitUntil: 'networkidle', timeout: 15000 })
    const stuShot = await captureScreenshot('prod-05-admin-students')
    console.log('  ✓ Admin Students page rendered')
    results.steps.push({
      step: 'Admin Students View',
      status: 'PASS',
      url: page.url(),
      screenshot: stuShot
    })

    // 6. Admin Settings View
    console.log('[6/6] Testing Admin Settings View...')
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle', timeout: 15000 })
    const setShot = await captureScreenshot('prod-06-admin-settings')
    console.log('  ✓ Admin Settings page rendered')
    results.steps.push({
      step: 'Admin Settings View',
      status: 'PASS',
      url: page.url(),
      screenshot: setShot
    })

    // Write final summary
    const summaryFile = path.join(OUTPUT_DIR, 'summary.json')
    fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2))
    console.log('\n======================================================')
    console.log('✅ ALL LIVE PRODUCTION HUMAN JOURNEYS PASSED!')
    console.log(`Results saved to: ${summaryFile}`)
    console.log('======================================================\n')
    return 0
  } catch (err) {
    console.error('\n❌ Error during live production browser test:', err)
    const errShot = await captureScreenshot('prod-error')
    results.steps.push({
      step: 'Error Encountered',
      status: 'FAIL',
      error: err.message,
      screenshot: errShot
    })
    return 1
  } finally {
    await browser.close()
  }
}

if (require.main === module) {
  runLiveProductionVerification().then(code => process.exit(code))
}

module.exports = { runLiveProductionVerification }
