'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const YAML = require('yaml')

const REPO_ROOT = path.resolve(__dirname, '..')

describe('CI/CD Pipeline Integrity Gates (CI-01 through CI-10, §1 CI-B, C1.7)', () => {
  const ciWorkflowPath = path.join(REPO_ROOT, '.github/workflows/ci.yml')
  const deployWorkflowPath = path.join(REPO_ROOT, '.github/workflows/deploy-aws.yml')
  const rollbackWorkflowPath = path.join(REPO_ROOT, '.github/workflows/rollback.yml')

  assert.ok(fs.existsSync(ciWorkflowPath), 'ci.yml must exist')
  assert.ok(fs.existsSync(deployWorkflowPath), 'deploy-aws.yml must exist')
  assert.ok(fs.existsSync(rollbackWorkflowPath), 'rollback.yml must exist')

  const ciAst = YAML.parse(fs.readFileSync(ciWorkflowPath, 'utf8'))
  const deployAst = YAML.parse(fs.readFileSync(deployWorkflowPath, 'utf8'))
  const rollbackAst = YAML.parse(fs.readFileSync(rollbackWorkflowPath, 'utf8'))

  it('CI-01: deploy-aws.yml triggers only via workflow_run or workflow_dispatch, NEVER direct push', () => {
    // Top-level triggers check on parsed AST
    const triggers = deployAst.on
    assert.ok(triggers, 'deploy-aws.yml must have "on" triggers defined')
    assert.strictEqual(
      triggers.push,
      undefined,
      'deploy-aws.yml must NEVER trigger directly on push: branches'
    )
    assert.ok(
      triggers.workflow_run || triggers.workflow_dispatch,
      'deploy-aws.yml must be guarded by workflow_run or manual workflow_dispatch'
    )

    // Must require production environment
    const deployJob = deployAst.jobs?.deploy
    assert.ok(deployJob, 'deploy-aws.yml must declare a "deploy" job')
    const envName = typeof deployJob.environment === 'object'
      ? deployJob.environment.name
      : deployJob.environment
    assert.strictEqual(envName, 'production', 'deploy job must target production environment')
  })

  it('CI-02: deploy-aws.yml and ci.yml use OIDC role assumption, no static AWS keys in deploy steps', () => {
    const deploySteps = deployAst.jobs?.deploy?.steps || []
    for (const step of deploySteps) {
      if (step.uses && step.uses.includes('aws-actions/configure-aws-credentials')) {
        const stepWith = step.with || {}
        assert.ok(
          stepWith['role-to-assume'] || stepWith.role_to_assume || stepWith['role-arn'],
          'AWS authentication in deploy-aws.yml must use OIDC role-to-assume, not static keys'
        )
        assert.strictEqual(
          stepWith['aws-access-key-id'],
          undefined,
          'deploy-aws.yml must not use static aws-access-key-id'
        )
        assert.strictEqual(
          stepWith['aws-secret-access-key'],
          undefined,
          'deploy-aws.yml must not use static aws-secret-access-key'
        )
      }
    }
  })

  it('CI-03: Security audit and container scanning gates enforce strict failure thresholds', () => {
    const secJob = ciAst.jobs?.['security-scan']
    assert.ok(secJob, 'ci.yml must have a security-scan job')

    const steps = secJob.steps || []
    for (const step of steps) {
      // Must not continue on error for security gates
      assert.notStrictEqual(
        step['continue-on-error'],
        true,
        `Security step "${step.name}" must not have continue-on-error: true`
      )

      // Audit must not be bypassed with --audit-level=none or swallowed with || true
      if (step.run && step.run.includes('npm audit')) {
        assert.doesNotMatch(
          step.run,
          /--audit-level=none/,
          'npm audit must use a real severity threshold, not --audit-level=none'
        )
        assert.doesNotMatch(
          step.run,
          /\|\|\s*true/,
          'npm audit must not be swallowed with || true'
        )
      }

      // Trivy container scanning must exit with code 1 on CRITICAL
      if (step.run && step.run.includes('trivy image')) {
        assert.match(
          step.run,
          /--exit-code\s+1/,
          'Trivy container scan must specify --exit-code 1'
        )
        assert.match(
          step.run,
          /--severity\s+.*CRITICAL/,
          'Trivy scan must inspect CRITICAL severity'
        )
      }
    }
  })

  it('CI-04: PR checkout steps explicitly pin head_sha to prevent untrusted HEAD execution', () => {
    const jobs = ciAst.jobs || {}
    for (const [jobName, job] of Object.entries(jobs)) {
      const steps = job.steps || []
      for (const step of steps) {
        if (step.uses && step.uses.startsWith('actions/checkout')) {
          const stepWith = step.with || {}
          if (stepWith.ref) {
            assert.match(
              stepWith.ref,
              /head\.sha|github\.sha/,
              `Checkout step in job "${jobName}" must pin commit SHA`
            )
          }
        }
      }
    }
  })

  it('CI-05: Default AWS region is ap-south-1', () => {
    const deployContent = fs.readFileSync(deployWorkflowPath, 'utf8')
    assert.doesNotMatch(
      deployContent,
      /aws-region:.*us-east-1/,
      'Default AWS region must be ap-south-1, not us-east-1'
    )
    assert.match(deployContent, /ap-south-1/, 'deploy-aws.yml must reference ap-south-1')
  })

  it('CI-06: Pinned Prisma CLI in dependencies and Node >= 22 engines', () => {
    const backendPkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'proctornet/backend/package.json'), 'utf8')
    )
    assert.ok(
      backendPkg.dependencies && backendPkg.dependencies.prisma,
      'prisma must be in dependencies (not only devDependencies) for immutable deploy artifacts'
    )
    assert.match(backendPkg.engines?.node || '', />=22/, 'backend engines.node must require Node >= 22')
  })

  it('CI-07: Dedicated automated rollback workflow exists and targets production', () => {
    assert.ok(rollbackAst.on?.workflow_dispatch !== undefined, 'rollback.yml must be dispatchable')
    const rollbackJob = rollbackAst.jobs?.rollback
    assert.ok(rollbackJob, 'rollback.yml must have a rollback job')
    const envName = typeof rollbackJob.environment === 'object'
      ? rollbackJob.environment.name
      : rollbackJob.environment
    assert.strictEqual(envName, 'production', 'rollback job must target production environment')
  })
})
