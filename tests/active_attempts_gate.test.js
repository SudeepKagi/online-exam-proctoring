import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const REPO_ROOT = path.resolve('.')
const SCRIPT_PATH = path.join(REPO_ROOT, 'proctornet/backend/scripts/ops/active-attempts.js')
const DEPLOY_SCRIPT_PATH = path.join(REPO_ROOT, 'ops/aws/scripts/deploy-release.sh')

describe('Exam-Aware Deployment Gate (FLW-09 / S5 / Appendix D)', () => {
  test('active-attempts.js script exists in proctornet/backend/scripts/ops/', () => {
    assert.ok(
      fs.existsSync(SCRIPT_PATH),
      'active-attempts.js must exist at proctornet/backend/scripts/ops/active-attempts.js'
    )
  })

  test('active-attempts.js executes and outputs integer count of ACTIVE attempts', () => {
    assert.ok(fs.existsSync(SCRIPT_PATH), 'script must exist')
    const output = execSync(`node "${SCRIPT_PATH}"`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' }
    }).trim()

    // Must be a non-negative integer
    const count = parseInt(output, 10)
    assert.ok(!Number.isNaN(count) && count >= 0, `Output "${output}" must be an integer count`)
  })

  test('deploy-release.sh contains exam-aware active attempts gate and --override support', () => {
    assert.ok(fs.existsSync(DEPLOY_SCRIPT_PATH), 'deploy-release.sh must exist')
    const content = fs.readFileSync(DEPLOY_SCRIPT_PATH, 'utf8')

    // Must query active-attempts.js
    assert.match(
      content,
      /active-attempts\.js/,
      'deploy-release.sh must invoke active-attempts.js during preflight'
    )

    // Must refuse deployment with exit code 3 when attempts > 0 without override
    assert.match(
      content,
      /exit 3/,
      'deploy-release.sh must exit with code 3 when active attempts are detected'
    )

    // Must support override parameter/flag
    assert.match(
      content,
      /OVERRIDE|override/,
      'deploy-release.sh must support an override reason'
    )
  })
})
