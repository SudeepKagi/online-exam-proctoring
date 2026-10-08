import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { pathToFileURL } from 'node:url'

const REPO_ROOT = path.resolve('.')

describe('Version & Build Metadata Endpoint (S5 / CI-10 / §3.2)', () => {
  test('version utility exists and resolves version and commit SHA', async () => {
    const versionUtilPath = path.join(REPO_ROOT, 'proctornet/backend/src/utils/version.js')
    assert.ok(fs.existsSync(versionUtilPath), 'version.js utility must exist')
    
    const versionUtil = await import(pathToFileURL(versionUtilPath).href)
    const versionInfo = versionUtil.getVersion()
    
    assert.ok(versionInfo.version, 'versionInfo must have version string')
    assert.ok(versionInfo.gitSha, 'versionInfo must have gitSha')
    assert.ok(versionInfo.builtAt, 'versionInfo must have builtAt timestamp')
    assert.ok(versionInfo.nodeVersion, 'versionInfo must report runtime nodeVersion')
  })

  test('GET /api/v1/version route is registered in v1Router', () => {
    const routerPath = path.join(REPO_ROOT, 'proctornet/backend/src/modules/router.js')
    const content = fs.readFileSync(routerPath, 'utf8')
    assert.match(
      content,
      /router\.get\(\s*['"]\/version['"]/,
      'router.js must mount GET /version endpoint'
    )
  })
})
