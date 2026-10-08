import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml' // if available, or regex/line parser

const REPO_ROOT = path.resolve('.')

describe('CI/CD Pipeline Integrity Gates (CI-01 through CI-10)', () => {
  const ciWorkflowPath = path.join(REPO_ROOT, '.github/workflows/ci.yml')
  const deployWorkflowPath = path.join(REPO_ROOT, '.github/workflows/deploy-aws.yml')
  const rollbackWorkflowPath = path.join(REPO_ROOT, '.github/workflows/rollback.yml')

  test('CI-01: deploy-aws.yml does not trigger on direct push without CI gate', () => {
    assert.ok(fs.existsSync(deployWorkflowPath), 'deploy-aws.yml must exist')
    const content = fs.readFileSync(deployWorkflowPath, 'utf8')
    
    // Must NOT have un-gated push trigger on branches: [main]
    const hasUngatedPush = /on:\s*[^]*?\bpush:\s*[^]*?branches:\s*\[\s*main\s*\]/m.test(content)
    assert.strictEqual(
      hasUngatedPush,
      false,
      'deploy-aws.yml must NOT deploy directly on push to main (must require workflow_run or workflow_dispatch)'
    )

    // Must require environment production
    assert.match(content, /environment:\s*(\n\s*name:\s*)?['"]?production['"]?/, 'deploy-aws.yml must require production environment')
  })

  test('CI-02 & CI-03: ci.yml executes full test suite and strictly fails on errors', () => {
    assert.ok(fs.existsSync(ciWorkflowPath), 'ci.yml must exist')
    const content = fs.readFileSync(ciWorkflowPath, 'utf8')

    // Must NOT swallow lint errors with || true
    assert.doesNotMatch(content, /npm run lint\s*\|\|\s*true/, 'ci.yml must NOT swallow lint errors with || true')

    // Must NOT swallow npm audit errors with || true
    assert.doesNotMatch(content, /npm audit.*\|\|\s*true/, 'ci.yml must NOT swallow audit failures with || true')

    // Must include all CI gate scripts
    assert.match(content, /check-no-stubs\.js/, 'ci.yml must run check-no-stubs.js')
    assert.match(content, /check-no-legacy\.js/, 'ci.yml must run check-no-legacy.js')
    assert.match(content, /check-doc-links\.js/, 'ci.yml must run check-doc-links.js')
    assert.match(content, /scan-banned-terms\.js/, 'ci.yml must run scan-banned-terms.js')

    // Must run full test suites, not just 5 legacy files
    assert.match(content, /tests\/route-matrix\.test\.js/, 'ci.yml must run route-matrix tests')
    assert.match(content, /tests\/q5-bola-fuzz\.test\.js/, 'ci.yml must run BOLA tests')
  })

  test('CI-04: Default AWS region is ap-south-1', () => {
    const deployContent = fs.readFileSync(deployWorkflowPath, 'utf8')
    assert.doesNotMatch(
      deployContent,
      /aws-region:.*us-east-1/,
      'Default AWS region must be ap-south-1, not us-east-1'
    )
    assert.match(deployContent, /ap-south-1/, 'deploy-aws.yml must reference ap-south-1')
  })

  test('CI-05 & CI-06: Pinned Prisma CLI in dependencies and Node 22 engines', () => {
    const backendPkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'proctornet/backend/package.json'), 'utf8')
    )
    
    // Prisma must be in dependencies so npm ci --omit=dev installs it
    assert.ok(
      backendPkg.dependencies && backendPkg.dependencies.prisma,
      'prisma must be in dependencies (not only devDependencies) for immutable deploy artifacts'
    )

    // Node engine >= 22
    assert.match(backendPkg.engines?.node || '', />=22/, 'backend engines.node must require Node >= 22')
  })

  test('CI-09: Dedicated automated rollback workflow exists', () => {
    assert.ok(fs.existsSync(rollbackWorkflowPath), 'rollback.yml must exist')
    const content = fs.readFileSync(rollbackWorkflowPath, 'utf8')
    assert.match(content, /workflow_dispatch/, 'rollback.yml must be dispatchable')
    assert.match(content, /environment:\s*(\n\s*name:\s*)?['"]?production['"]?/, 'rollback.yml must target production environment')
  })
})
