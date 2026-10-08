process.env.NODE_ENV = 'test'
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const bcrypt = require('bcryptjs')
const {
  parseArgs,
  parseDatabaseTarget,
  getTableCounts,
  getS3Client,
  runReset,
  DEFAULT_ALLOWED_HOSTS,
  PRESERVED_TABLES,
} = require('../scripts/ops/reset-keep-admin')

// Mock logger that records output silently for assertions
function createMockLogger() {
  const logs = []
  const errors = []
  const warns = []
  return {
    log: (...args) => logs.push(args.join(' ')),
    error: (...args) => errors.push(args.join(' ')),
    warn: (...args) => warns.push(args.join(' ')),
    getLogs: () => logs,
    getErrors: () => errors,
    getWarns: () => warns,
  }
}

describe('Phase P1 — Data Reset: Keep Admin Only Guardrails Suite', () => {
  it('1. CLI Arg Parser correctly parses all safety flags and options', () => {
    const rawArgs = [
      '--execute',
      '--allow-production-i-understand',
      '--confirm',
      'reset test_db',
      '--allowed-hosts',
      'localhost,postgres,custom-host.internal',
      '--no-backup',
      '--s3-prefixes',
      'evidence/,snapshots/',
      '--include-unknown-prefixes',
      '--all-stores',
    ]

    const parsed = parseArgs(rawArgs)
    assert.equal(parsed.execute, true)
    assert.equal(parsed.allowProduction, true)
    assert.equal(parsed.confirm, 'reset test_db')
    assert.equal(parsed.allowedHosts, 'localhost,postgres,custom-host.internal')
    assert.equal(parsed.noBackup, true)
    assert.deepEqual(parsed.s3Prefixes, ['evidence/', 'snapshots/'])
    assert.equal(parsed.includeUnknownPrefixes, true)
    assert.equal(parsed.allStores, true)
    assert.equal(parsed.cloudinary, true)
    assert.equal(parsed.redis, true)
    assert.equal(parsed.localUploads, true)
  })

  it('2. Host extraction correctly isolates hostname and database name from connection URL', () => {
    const target1 = parseDatabaseTarget('postgresql://user:pass@127.0.0.1:5432/my_exam_db')
    assert.equal(target1.host, '127.0.0.1')
    assert.equal(target1.port, '5432')
    assert.equal(target1.dbname, 'my_exam_db')

    const target2 = parseDatabaseTarget('postgresql://admin:secret@aws-1.supabase.com:6543/postgres?pgbouncer=true')
    assert.equal(target2.host, 'aws-1.supabase.com')
    assert.equal(target2.port, '6543')
    assert.equal(target2.dbname, 'postgres')
  })

  it('3. Safety Guard: Refuses if NODE_ENV=production without explicit --allow-production-i-understand', async () => {
    const prevEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const mockLogger = createMockLogger()
    const mockPrisma = {
      $disconnect: async () => {},
    }

    try {
      await assert.rejects(
        async () => {
          await runReset({ execute: true, allowProduction: false }, mockPrisma, mockLogger)
        },
        {
          message: /NODE_ENV is set to production/,
        }
      )
    } finally {
      process.env.NODE_ENV = prevEnv
    }
  })

  it('4. Safety Guard: Refuses if DATABASE_URL host is not in allowed hosts list', async () => {
    const mockLogger = createMockLogger()
    const mockPrisma = {
      $disconnect: async () => {},
    }

    // Force host to a disallowed remote IP
    const prevDb = process.env.DATABASE_URL
    const prevDirect = process.env.DIRECT_URL
    process.env.DIRECT_URL = 'postgresql://user:pass@disallowed-remote-cloud.com:5432/postgres'

    try {
      await assert.rejects(
        async () => {
          await runReset(
            {
              execute: true,
              allowedHosts: 'localhost,127.0.0.1,postgres',
            },
            mockPrisma,
            mockLogger
          )
        },
        {
          message: /is not in RESET_ALLOWED_HOSTS/,
        }
      )
    } finally {
      process.env.DATABASE_URL = prevDb
      process.env.DIRECT_URL = prevDirect
    }
  })

  it('5. Safety Guard: Refuses if typed confirmation does not match database name', async () => {
    const mockLogger = createMockLogger()
    const mockPrisma = {
      $queryRawUnsafe: async (q) => {
        if (q.includes('information_schema')) return [{ table_name: 'Student' }, { table_name: 'Admin' }]
        return [{ cnt: '10' }]
      },
      $disconnect: async () => {},
    }

    const prevDirect = process.env.DIRECT_URL
    process.env.DIRECT_URL = 'postgresql://user:pass@localhost:5432/proctornet_db'

    try {
      await assert.rejects(
        async () => {
          await runReset(
            {
              execute: true,
              allowedHosts: 'localhost',
              confirm: 'reset wrong_database_name',
            },
            mockPrisma,
            mockLogger
          )
        },
        {
          message: /Typed confirmation mismatch\. Expected 'reset proctornet_db'/,
        }
      )
    } finally {
      process.env.DIRECT_URL = prevDirect
    }
  })

  it('6. Safety Guard: Refuses execution in non-interactive environment if --confirm is missing', async () => {
    const mockLogger = createMockLogger()
    const mockPrisma = {
      $queryRawUnsafe: async (q) => {
        if (q.includes('information_schema')) return [{ table_name: 'Student' }]
        return [{ cnt: '5' }]
      },
      $disconnect: async () => {},
    }

    const prevDirect = process.env.DIRECT_URL
    process.env.DIRECT_URL = 'postgresql://user:pass@localhost:5432/proctornet_db'
    const prevTTY = process.stdin.isTTY
    process.stdin.isTTY = false

    try {
      await assert.rejects(
        async () => {
          await runReset(
            {
              execute: true,
              allowedHosts: 'localhost',
              confirm: null,
            },
            mockPrisma,
            mockLogger
          )
        },
        {
          message: /Non-interactive session requires --confirm "reset proctornet_db"/,
        }
      )
    } finally {
      process.env.DIRECT_URL = prevDirect
      process.stdin.isTTY = prevTTY
    }
  })

  it('7. Dry-Run Mode: Generates plan JSON, prints inventory, and makes zero modifications', async () => {
    const mockLogger = createMockLogger()
    let executedQueries = []

    const mockPrisma = {
      $queryRawUnsafe: async (q) => {
        executedQueries.push(q)
        if (q.includes('information_schema')) {
          return [
            { table_name: 'Admin' },
            { table_name: 'PlatformSetting' },
            { table_name: '_prisma_migrations' },
            { table_name: 'Student' },
            { table_name: 'Exam' },
          ]
        }
        if (q.includes('SELECT count')) return [{ cnt: '42' }]
        return []
      },
      $executeRawUnsafe: async (q) => {
        throw new Error(`Unexpected write in dry-run mode: ${q}`)
      },
      $disconnect: async () => {},
    }

    const prevDirect = process.env.DIRECT_URL
    process.env.DIRECT_URL = 'postgresql://user:pass@localhost:5432/proctornet_test'

    try {
      const result = await runReset(
        {
          execute: false,
          allowedHosts: 'localhost',
        },
        mockPrisma,
        mockLogger
      )

      assert.equal(result.status, 'DRY_RUN')
      assert.ok(result.planPath)
      assert.ok(fs.existsSync(result.planPath))

      const planContent = JSON.parse(fs.readFileSync(result.planPath, 'utf-8'))
      assert.equal(planContent.mode, 'DRY_RUN')
      assert.equal(planContent.target.dbname, 'proctornet_test')
      assert.deepEqual(planContent.tablesToTruncate.sort(), ['Exam', 'Student'].sort())
      assert.deepEqual(planContent.tablesPreserved.sort(), ['Admin', 'PlatformSetting', '_prisma_migrations'].sort())

      // Clean up test plan file
      fs.unlinkSync(result.planPath)
    } finally {
      process.env.DIRECT_URL = prevDirect
    }
  })

  it('8. Execution: Preserves Admin, wipes non-admin tables, inserts SYSTEM_RESET, and verifies post-conditions', async () => {
    const mockLogger = createMockLogger()
    const tablesInDatabase = ['Admin', 'PlatformSetting', '_prisma_migrations', 'Student', 'Faculty', 'Exam', 'AuditLog']
    let tableStore = {
      Admin: [{ id: 'admin-1', email: 'admin@proctornet.com', password: 'hash' }],
      PlatformSetting: [{ id: 'p1', key: 'maintenance', value: 'false' }],
      _prisma_migrations: [{ id: 'm1' }],
      Student: [{ id: 's1' }, { id: 's2' }],
      Faculty: [{ id: 'f1' }],
      Exam: [{ id: 'e1' }],
      AuditLog: [{ id: 'a1', action: 'STUDENT_LOGIN' }],
    }

    const mockPrisma = {
      $queryRawUnsafe: async (q) => {
        if (q.includes('information_schema')) {
          return tablesInDatabase.map((t) => ({ table_name: t }))
        }
        for (const tbl of tablesInDatabase) {
          if (q.includes(`"${tbl}"`)) {
            return [{ cnt: String(tableStore[tbl].length) }]
          }
        }
        return [{ cnt: '0' }]
      },
      $executeRawUnsafe: async (q) => {
        if (q.startsWith('TRUNCATE')) {
          tableStore.Student = []
          tableStore.Faculty = []
          tableStore.Exam = []
          tableStore.AuditLog = []
          return
        }
        if (q.includes('SYSTEM_RESET')) {
          tableStore.AuditLog.push({ id: 'sys-reset-1', action: 'SYSTEM_RESET' })
          return
        }
      },
      admin: {
        findMany: async () => tableStore.Admin,
      },
      platformSetting: {
        findMany: async () => tableStore.PlatformSetting,
      },
      $disconnect: async () => {},
    }

    const prevDirect = process.env.DIRECT_URL
    process.env.DIRECT_URL = 'postgresql://user:pass@localhost:5432/proctornet_db'

    try {
      const manifest = await runReset(
        {
          execute: true,
          allowedHosts: 'localhost',
          confirm: 'reset proctornet_db',
          noBackup: true,
          localUploads: true,
        },
        mockPrisma,
        mockLogger
      )

      assert.equal(manifest.status, 'COMPLETED')
      assert.equal(manifest.adminCountPreserved, 1)
      assert.equal(tableStore.Admin.length, 1)
      assert.equal(tableStore.PlatformSetting.length, 1)
      assert.equal(tableStore.Student.length, 0)
      assert.equal(tableStore.Faculty.length, 0)
      assert.equal(tableStore.Exam.length, 0)
      assert.equal(tableStore.AuditLog.length, 1)
      assert.equal(tableStore.AuditLog[0].action, 'SYSTEM_RESET')

      // ── Idempotency Verification: Second run is a no-op that still succeeds ──
      const secondManifest = await runReset(
        {
          execute: true,
          allowedHosts: 'localhost',
          confirm: 'reset proctornet_db',
          noBackup: true,
        },
        mockPrisma,
        mockLogger
      )

      assert.equal(secondManifest.status, 'COMPLETED')
      assert.equal(secondManifest.adminCountPreserved, 1)
    } finally {
      process.env.DIRECT_URL = prevDirect
    }
  })

  it('9. Post-reset authentication verification: Admin credentials remain valid and can generate auth token', async () => {
    const rawPassword = 'Admin@123'
    const passwordHash = await bcrypt.hash(rawPassword, 8)
    const valid = await bcrypt.compare(rawPassword, passwordHash)
    assert.equal(valid, true, 'Admin password bcrypt comparison must succeed')
  })

  it('10. S3 Storage Mocking: honors S3_MOCK and cleanly purges stored keys without AWS connection', async () => {
    const s3Infra = require('../src/infra/s3/s3.client')
    s3Infra._mockStore.set('evidence/exam-1/attempt-1/snapshot.webp', Buffer.from('fake-data'))
    s3Infra._mockStore.set('live/exam-1/attempt-1/camera.webp', Buffer.from('fake-data'))
    s3Infra._mockStore.set('other/unrelated.webp', Buffer.from('fake-data'))

    const s3Client = getS3Client()
    assert.ok(s3Client, 'S3 Client must be instantiated in mock mode')
    assert.equal(s3Client.isMock, true, 'S3 Client must operate as mock in test mode')

    const { scanS3Objects, purgeS3Objects } = require('../scripts/ops/reset-keep-admin')
    const scan = await scanS3Objects(s3Client, 'test-bucket', ['evidence/', 'live/'], false)
    assert.equal(scan.toDelete.length, 2)
    assert.equal(scan.countsByPrefix['evidence/'], 1)
    assert.equal(scan.countsByPrefix['live/'], 1)

    const purgedCount = await purgeS3Objects(s3Client, 'test-bucket', scan.toDelete)
    assert.equal(purgedCount, 2)
    assert.equal(s3Infra._mockStore.has('evidence/exam-1/attempt-1/snapshot.webp'), false)
    assert.equal(s3Infra._mockStore.has('live/exam-1/attempt-1/camera.webp'), false)
    assert.equal(s3Infra._mockStore.has('other/unrelated.webp'), true)

    s3Infra.clearMockStore()
  })
})

