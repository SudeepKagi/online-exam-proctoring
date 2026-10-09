'use strict'

process.env.NODE_ENV = 'test'
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  getTableClassifications,
  validateClassificationIntegrity
} = require('../scripts/ops/tableClassification')
const {
  executeDatabaseReset,
  purgeS3Storage,
  parseArgs,
  parseDbInfo,
  ALLOWED_PURGE_PREFIXES,
  FORBIDDEN_PURGE_PREFIXES
} = require('../scripts/ops/reset-keep-admin')
const { MemoryS3Adapter } = require('../src/infra/s3/s3Adapter')

describe('Phase T3 — Admin-Only Database & Storage Reset Engine', () => {
  it('1. Schema classification: Every Prisma model is classified; throws if any model is missing', () => {
    const classification = validateClassificationIntegrity()
    assert.ok(classification.keepIdentity.includes('admins'), 'admins must be in KEEP_IDENTITY')
    assert.ok(classification.keepConfig.includes('platform_settings'), 'platform_settings must be in KEEP_CONFIG')
    assert.ok(classification.keepConfig.includes('departments'), 'departments must be in KEEP_CONFIG')
    assert.ok(classification.keepConfig.includes('agent_rules'), 'agent_rules must be in KEEP_CONFIG')
    assert.ok(classification.keepConfig.includes('agent_policy_versions'), 'agent_policy_versions must be in KEEP_CONFIG')
    assert.ok(classification.keepConfig.includes('agent_releases'), 'agent_releases must be in KEEP_CONFIG')
    assert.ok(classification.resetLeases.includes('vpn_ip_pool'), 'vpn_ip_pool must be in RESET_LEASES')

    // Critical user and attempt tables must be in WIPE
    const criticalWipe = ['students', 'faculties', 'exams', 'questions', 'exam_attempts', 'answers', 'audit_logs', 'auth_sessions']
    for (const tbl of criticalWipe) {
      assert.ok(classification.wipe.includes(tbl), `Table "${tbl}" must be classified under WIPE`)
    }

    assert.equal(classification.unclassified.length, 0, 'Zero unclassified tables allowed')
  })

  it('2. S3 Purge Boundaries: Purges identity/evidence/live/thumbs/uploads/attempts, NEVER touches agent/releases/backups', async () => {
    const memS3 = new MemoryS3Adapter({ bucket: 'proctornet-test-bucket' })

    // Populate objects to be purged
    await memS3.putObject('identity/std-1/profile.webp', Buffer.from('img1'))
    await memS3.putObject('evidence/exam-1/att-1/snap.webp', Buffer.from('img2'))
    await memS3.putObject('live/exam-1/att-1/cam.webp', Buffer.from('img3'))
    await memS3.putObject('thumbs/exam-1/att-1/t.webp', Buffer.from('img4'))
    await memS3.putObject('uploads/temp.webp', Buffer.from('img5'))
    await memS3.putObject('attempts/att-1/data.webp', Buffer.from('img6'))

    // Populate protected objects that must NEVER be deleted
    await memS3.putObject('agent/v1.0.0/proctornet-agent.exe', Buffer.from('binary-agent'))
    await memS3.putObject('releases/release-v1.0.0.tar.gz', Buffer.from('tarball'))
    await memS3.putObject('backups/db-pre-reset.sql', Buffer.from('dump'))

    // Execute S3 purge
    const summary = await purgeS3Storage(memS3, 'proctornet-test-bucket', false)
    assert.equal(summary.totalPurged, 6)

    // Verify purged objects are gone
    await assert.rejects(async () => memS3.headObject('identity/std-1/profile.webp'), { name: 'NotFound' })
    await assert.rejects(async () => memS3.headObject('evidence/exam-1/att-1/snap.webp'), { name: 'NotFound' })
    await assert.rejects(async () => memS3.headObject('live/exam-1/att-1/cam.webp'), { name: 'NotFound' })
    await assert.rejects(async () => memS3.headObject('thumbs/exam-1/att-1/t.webp'), { name: 'NotFound' })
    await assert.rejects(async () => memS3.headObject('uploads/temp.webp'), { name: 'NotFound' })
    await assert.rejects(async () => memS3.headObject('attempts/att-1/data.webp'), { name: 'NotFound' })

    // Verify protected objects REMAIN intact
    const agentObj = await memS3.headObject('agent/v1.0.0/proctornet-agent.exe')
    assert.ok(agentObj)
    const releaseObj = await memS3.headObject('releases/release-v1.0.0.tar.gz')
    assert.ok(releaseObj)
    const backupObj = await memS3.headObject('backups/db-pre-reset.sql')
    assert.ok(backupObj)
  })

  it('3. S3 Purge versioned bucket: Cleans all object versions under allowed prefixes', async () => {
    const memS3 = new MemoryS3Adapter({ bucket: 'versioned-bucket' })

    // Put two versions of the same key
    await memS3.putObject('evidence/exam-1/v.webp', Buffer.from('v1'))
    await memS3.putObject('evidence/exam-1/v.webp', Buffer.from('v2'))

    const verResBefore = await memS3.listObjectVersions('evidence/')
    assert.equal(verResBefore.Versions.length, 2)

    await purgeS3Storage(memS3, 'versioned-bucket', false)

    const verResAfter = await memS3.listObjectVersions('evidence/')
    assert.equal(verResAfter.Versions.length, 0)
  })

  it('4. Safety Gate: Refuses to execute if any exam attempt is ACTIVE', async () => {
    const mockPrisma = {
      admin: { count: async () => 1 },
      examAttempt: { count: async () => 3 }, // 3 ACTIVE attempts
      $queryRawUnsafe: async () => [{ count: 0 }]
    }

    await assert.rejects(
      async () => {
        await executeDatabaseReset(mockPrisma, { dryRun: false, backupRef: 'ref-1' })
      },
      {
        message: /Cannot reset database while 3 exam attempt\(s\) are ACTIVE/
      }
    )
  })

  it('5. Safety Gate: Refuses to execute if admin count < 1', async () => {
    const mockPrisma = {
      admin: { count: async () => 0 },
      examAttempt: { count: async () => 0 },
      $queryRawUnsafe: async () => [{ count: 0 }]
    }

    await assert.rejects(
      async () => {
        await executeDatabaseReset(mockPrisma, { dryRun: false, backupRef: 'ref-1' })
      },
      {
        message: /At least 1 Admin account must exist/
      }
    )
  })

  it('6. Failure Injection: Post-condition mismatch causes transaction rollback', async () => {
    let transactionExecuted = false
    const mockPrisma = {
      admin: { count: async () => 1 },
      examAttempt: { count: async () => 0 },
      $queryRawUnsafe: async (sql) => {
        if (sql.includes('admins')) return [{ count: 1 }]
        return [{ count: 10 }]
      },
      $transaction: async (fn) => {
        transactionExecuted = true
        // Mock tx where postAdminCount unexpectedly dropped to 0
        const mockTx = {
          $executeRawUnsafe: async () => 1,
          $queryRawUnsafe: async (sql) => {
            if (sql.includes('admins')) {
              return [{ postAdminCount: 0 }] // Mismatch!
            }
            return [{ cnt: 0 }]
          }
        }
        await fn(mockTx)
      }
    }

    await assert.rejects(
      async () => {
        await executeDatabaseReset(mockPrisma, { dryRun: false, backupRef: 'backup-123' })
      },
      {
        message: /POST-CONDITION FAILED: Admins count changed/
      }
    )
    assert.equal(transactionExecuted, true)
  })

  it('7. Dry-run mode: Performs zero mutations and outputs summary report', async () => {
    let txCalled = false
    const mockPrisma = {
      admin: { count: async () => 2 },
      examAttempt: { count: async () => 0 },
      $queryRawUnsafe: async (sql) => {
        if (sql.includes('admins')) return [{ count: 2 }]
        return [{ count: 5 }]
      },
      $transaction: async () => { txCalled = true }
    }

    const res = await executeDatabaseReset(mockPrisma, { dryRun: true, backupRef: 'test-backup' })
    assert.equal(res.dryRun, true)
    assert.equal(res.initialAdminCount, 2)
    assert.equal(txCalled, false, 'Transaction must not be called in dry-run mode')
  })
})
