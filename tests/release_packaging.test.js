import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve('.')

describe('Release Packaging & Runtime Self-Sufficiency (CI-09 / S5 / §3.2)', () => {
  test('all required release payload directories and files exist in source tree', () => {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'proctornet/backend')), 'proctornet/backend must exist')
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'shared')), 'shared/ must exist')
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'ops/caddy/Caddyfile')), 'ops/caddy/Caddyfile must exist')
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'ops/aws/scripts/deploy-release.sh')), 'deploy-release.sh must exist')
  })

  test('shared violationTypes.json is parseable and valid', () => {
    const violationTypesPath = path.join(REPO_ROOT, 'shared/violationTypes.json')
    assert.ok(fs.existsSync(violationTypesPath), 'shared/violationTypes.json must exist')
    const types = JSON.parse(fs.readFileSync(violationTypesPath, 'utf8'))
    assert.ok(Array.isArray(types) || typeof types === 'object', 'violationTypes must be JSON')
  })

  test('deploy-aws.yml packages proctornet/backend, frontend/dist, shared, ops/caddy/Caddyfile, and VERSION', () => {
    const deployWf = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/deploy-aws.yml'), 'utf8')
    assert.match(deployWf, /proctornet\/backend/, 'tarball must include proctornet/backend')
    assert.match(deployWf, /proctornet\/frontend\/dist/, 'tarball must include frontend/dist')
    assert.match(deployWf, /shared/, 'tarball must include shared directory')
    assert.match(deployWf, /ops\/caddy\/Caddyfile/, 'tarball must include Caddyfile')
    assert.match(deployWf, /VERSION/, 'tarball must include VERSION metadata')
  })
})
