#!/usr/bin/env node
'use strict'

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  ListObjectVersionsCommand,
} = require('@aws-sdk/client-s3')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const { execSync } = require('child_process')

// ── Default Configurations ──────────────────────────────────────────
const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'postgres']
const PRESERVED_TABLES = ['admin', 'platformsetting', '_prisma_migrations']
const DEFAULT_S3_PREFIXES = [
  'evidence/',
  'snapshots/',
  'biometrics/',
  'id-cards/',
  'face/',
  'uploads/',
  'reports/',
]

// ── Bounded Concurrency Helper ──────────────────────────────────────
async function mapConcurrent(items, limit, fn) {
  const results = []
  const executing = new Set()
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item))
    results.push(p)
    executing.add(p)
    const clean = () => executing.delete(p)
    p.then(clean).catch(clean)
    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }
  return Promise.all(results)
}

// ── Sleep with Jitter Helper ─────────────────────────────────────────
function sleepJitter(attempt, baseMs = 200) {
  const jitter = Math.random() * 100
  const delay = Math.min(baseMs * Math.pow(2, attempt) + jitter, 3000)
  return new Promise((resolve) => setTimeout(resolve, delay))
}

// ── CLI Arguments Parser ─────────────────────────────────────────────
function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    execute: false,
    allowProduction: false,
    allowedHosts: null,
    confirm: null,
    noBackup: false,
    s3Prefixes: null,
    includeUnknownPrefixes: false,
    cloudinary: false,
    compreface: false,
    minio: false,
    redis: false,
    rabbitmq: false,
    livekit: false,
    localUploads: false,
    wireguard: false,
    allStores: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--execute') args.execute = true
    else if (arg === '--allow-production-i-understand') args.allowProduction = true
    else if (arg === '--no-backup') args.noBackup = true
    else if (arg === '--include-unknown-prefixes') args.includeUnknownPrefixes = true
    else if (arg === '--cloudinary') args.cloudinary = true
    else if (arg === '--compreface') args.compreface = true
    else if (arg === '--minio') args.minio = true
    else if (arg === '--redis') args.redis = true
    else if (arg === '--rabbitmq') args.rabbitmq = true
    else if (arg === '--livekit') args.livekit = true
    else if (arg === '--local-uploads') args.localUploads = true
    else if (arg === '--wireguard') args.wireguard = true
    else if (arg === '--all-stores') {
      args.allStores = true
      args.cloudinary = true
      args.compreface = true
      args.minio = true
      args.redis = true
      args.rabbitmq = true
      args.livekit = true
      args.localUploads = true
      args.wireguard = true
    } else if (arg === '--confirm' && argv[i + 1]) {
      args.confirm = argv[++i]
    } else if (arg.startsWith('--confirm=')) {
      args.confirm = arg.slice(10)
    } else if (arg === '--allowed-hosts' && argv[i + 1]) {
      args.allowedHosts = argv[++i]
    } else if (arg.startsWith('--allowed-hosts=')) {
      args.allowedHosts = arg.slice(16)
    } else if (arg === '--s3-prefixes' && argv[i + 1]) {
      args.s3Prefixes = argv[++i].split(',').map((p) => p.trim())
    }
  }

  return args
}

// ── Host Extraction & Validation ────────────────────────────────────
function parseDatabaseTarget(dbUrl) {
  if (!dbUrl) throw new Error('DATABASE_URL or DIRECT_URL is required.')
  try {
    const parsed = new URL(dbUrl)
    const host = parsed.hostname
    const port = parsed.port || '5432'
    const dbname = parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'postgres'
    return { host, port, dbname }
  } catch (err) {
    throw new Error(`Failed to parse database connection URL: ${err.message}`)
  }
}

// ── Interactive Confirmation Prompt ─────────────────────────────────
function promptUser(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// ── S3 Client Initializer ────────────────────────────────────────────
function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || undefined
  const region = process.env.AWS_REGION || 'ap-south-1'
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

  if (!accessKeyId || !secretAccessKey) return null

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: { accessKeyId, secretAccessKey },
  })
}

// ── Table Discovery & Row Counting ──────────────────────────────────
async function getTableCounts(prisma) {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `
  const tables = await prisma.$queryRawUnsafe(query)
  const counts = {}

  for (const row of tables) {
    const tableName = row.table_name
    try {
      const res = await prisma.$queryRawUnsafe(`SELECT count(*)::text as cnt FROM "${tableName}";`)
      counts[tableName] = parseInt(res[0]?.cnt || '0', 10)
    } catch {
      counts[tableName] = 0
    }
  }

  return counts
}

// ── S3 Scanning & Purging ───────────────────────────────────────────
async function scanS3Objects(s3Client, bucketName, allowedPrefixes, includeUnknown) {
  if (!s3Client || !bucketName) return { countsByPrefix: {}, toDelete: [], unknownPrefixes: [] }

  const countsByPrefix = {}
  const toDelete = []
  const unknownPrefixes = new Set()

  // 1. Try listing object versions first (for version-enabled buckets)
  let isVersioned = false
  try {
    let keyMarker = undefined
    let versionMarker = undefined
    do {
      const cmd = new ListObjectVersionsCommand({
        Bucket: bucketName,
        KeyMarker: keyMarker,
        VersionIdMarker: versionMarker,
        MaxKeys: 1000,
      })
      const resp = await s3Client.send(cmd)
      isVersioned = Boolean(
        (resp.Versions && resp.Versions.length > 0) ||
          (resp.DeleteMarkers && resp.DeleteMarkers.length > 0)
      )

      const allItems = [...(resp.Versions || []), ...(resp.DeleteMarkers || [])]
      for (const item of allItems) {
        const key = item.Key
        if (!key) continue
        const topPrefix = key.includes('/') ? key.split('/')[0] + '/' : key
        const isKnown = allowedPrefixes.some((p) => key.startsWith(p))

        if (isKnown || includeUnknown) {
          countsByPrefix[topPrefix] = (countsByPrefix[topPrefix] || 0) + 1
          toDelete.push({ Key: key, VersionId: item.VersionId })
        } else {
          unknownPrefixes.add(topPrefix)
        }
      }

      keyMarker = resp.NextKeyMarker
      versionMarker = resp.NextVersionIdMarker
    } while (keyMarker)
  } catch (err) {
    // If ListObjectVersions not supported or fails, fallback to ListObjectsV2
    isVersioned = false
  }

  if (!isVersioned) {
    let continuationToken = undefined
    do {
      const cmd = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
      const resp = await s3Client.send(cmd)
      for (const obj of resp.Contents || []) {
        const key = obj.Key
        if (!key) continue
        const topPrefix = key.includes('/') ? key.split('/')[0] + '/' : key
        const isKnown = allowedPrefixes.some((p) => key.startsWith(p))

        if (isKnown || includeUnknown) {
          countsByPrefix[topPrefix] = (countsByPrefix[topPrefix] || 0) + 1
          toDelete.push({ Key: key })
        } else {
          unknownPrefixes.add(topPrefix)
        }
      }
      continuationToken = resp.NextContinuationToken
    } while (continuationToken)
  }

  return {
    countsByPrefix,
    toDelete,
    unknownPrefixes: Array.from(unknownPrefixes),
  }
}

async function purgeS3Objects(s3Client, bucketName, objectsToDelete) {
  if (!s3Client || !bucketName || objectsToDelete.length === 0) return 0

  const batchSize = 1000
  const batches = []
  for (let i = 0; i < objectsToDelete.length; i += batchSize) {
    batches.push(objectsToDelete.slice(i, i + batchSize))
  }

  let deletedCount = 0

  await mapConcurrent(batches, 4, async (batch) => {
    let attempt = 0
    let success = false
    while (!success && attempt < 4) {
      try {
        const cmd = new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: { Objects: batch.map((o) => ({ Key: o.Key, VersionId: o.VersionId })) },
        })
        const resp = await s3Client.send(cmd)
        deletedCount += resp.Deleted?.length || batch.length
        success = true
      } catch (err) {
        attempt++
        if (attempt >= 4) throw err
        await sleepJitter(attempt)
      }
    }
  })

  return deletedCount
}

// ── External Stores Purge Handlers ──────────────────────────────────
async function purgeExternalStores(args, logger = console) {
  const storeReports = {}

  // 1. Local Uploads
  if (args.localUploads) {
    const uploadsDir = path.resolve(__dirname, '../../uploads')
    try {
      if (fs.existsSync(uploadsDir)) {
        const entries = fs.readdirSync(uploadsDir)
        let removed = 0
        for (const file of entries) {
          const fullPath = path.join(uploadsDir, file)
          fs.rmSync(fullPath, { recursive: true, force: true })
          removed++
        }
        storeReports.localUploads = { status: 'SUCCESS', filesRemoved: removed }
        logger.log(`  [local-uploads] Cleaned ${removed} items from backend/uploads/`)
      } else {
        fs.mkdirSync(uploadsDir, { recursive: true })
        storeReports.localUploads = { status: 'SUCCESS', filesRemoved: 0 }
      }
    } catch (err) {
      storeReports.localUploads = { status: 'FAILED', error: err.message }
      logger.warn(`  [local-uploads] Error cleaning uploads directory: ${err.message}`)
    }
  }

  // 2. Cloudinary (Legacy)
  if (args.cloudinary) {
    if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const cloudinary = require('cloudinary').v2
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        })
        // Delete resources under standard folders
        await cloudinary.api.delete_resources_by_prefix('proctornet/')
        storeReports.cloudinary = { status: 'SUCCESS' }
        logger.log('  [cloudinary] Legacy prefix proctornet/ purged')
      } catch (err) {
        storeReports.cloudinary = { status: 'FAILED', error: err.message }
        logger.warn(`  [cloudinary] Purge skipped/failed: ${err.message}`)
      }
    } else {
      storeReports.cloudinary = { status: 'SKIPPED', reason: 'Unconfigured' }
    }
  }

  // 3. Redis (pn:* keys only, NEVER flushall)
  if (args.redis) {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST
    if (redisUrl) {
      try {
        // Dynamic require to prevent crash if ioredis not yet installed in P1
        const Redis = require('ioredis')
        const client = new Redis(redisUrl)
        const stream = client.scanStream({ match: 'pn:*', count: 100 })
        let keysDeleted = 0
        stream.on('data', async (resultKeys) => {
          if (resultKeys.length) {
            await client.unlink(...resultKeys)
            keysDeleted += resultKeys.length
          }
        })
        await new Promise((resolve) => stream.on('end', resolve))
        await client.quit()
        storeReports.redis = { status: 'SUCCESS', keysDeleted }
        logger.log(`  [redis] Deleted ${keysDeleted} keys matching pn:*`)
      } catch (err) {
        storeReports.redis = { status: 'SKIPPED', reason: err.message }
        logger.log(`  [redis] Redis purge skipped: ${err.message}`)
      }
    } else {
      storeReports.redis = { status: 'SKIPPED', reason: 'Unconfigured' }
    }
  }

  // 4. CompreFace
  if (args.compreface) {
    const comprefaceUrl = process.env.COMPREFACE_URL || process.env.PYTHON_SERVICE_URL
    const comprefaceKey = process.env.COMPREFACE_API_KEY
    if (comprefaceUrl && comprefaceKey) {
      try {
        const axios = require('axios')
        const listRes = await axios.get(`${comprefaceUrl}/api/v1/recognition/subjects`, {
          headers: { 'x-api-key': comprefaceKey },
          timeout: 4000,
        })
        const subjects = listRes.data?.subjects || []
        for (const sub of subjects) {
          await axios.delete(`${comprefaceUrl}/api/v1/recognition/subjects/${encodeURIComponent(sub)}`, {
            headers: { 'x-api-key': comprefaceKey },
            timeout: 3000,
          })
        }
        storeReports.compreface = { status: 'SUCCESS', subjectsDeleted: subjects.length }
        logger.log(`  [compreface] Deleted ${subjects.length} subjects`)
      } catch (err) {
        storeReports.compreface = { status: 'SKIPPED', reason: err.message }
        logger.log(`  [compreface] CompreFace purge skipped: ${err.message}`)
      }
    } else {
      storeReports.compreface = { status: 'SKIPPED', reason: 'Unconfigured' }
    }
  }

  // 5. RabbitMQ
  if (args.rabbitmq) {
    storeReports.rabbitmq = { status: 'SKIPPED', reason: 'No active amqp queues configured in P1' }
  }

  // 6. LiveKit
  if (args.livekit) {
    storeReports.livekit = { status: 'SKIPPED', reason: 'LiveKit RoomService unconfigured' }
  }

  // 7. WireGuard
  if (args.wireguard) {
    storeReports.wireguard = { status: 'SKIPPED', reason: 'VPN disabled or unconfigured' }
  }

  return storeReports
}

// ── Main Guarded Reset Logic ─────────────────────────────────────────
async function runReset(cliArgs = null, customPrisma = null, customLogger = console) {
  const args = cliArgs || parseArgs()
  const logger = customLogger
  const prisma = customPrisma || new PrismaClient()
  const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL

  const { host, port, dbname } = parseDatabaseTarget(dbUrl)
  const bucketName = process.env.AWS_S3_BUCKET_NAME || 'proctornet-evidence-storage'
  const prefixesToPurge = args.s3Prefixes || DEFAULT_S3_PREFIXES

  logger.log('\n=============================================================')
  logger.log('  PROCTORNET SYSTEM DATA RESET: KEEP ADMIN ONLY')
  logger.log('=============================================================')
  logger.log(`Target Host    : ${host}:${port}`)
  logger.log(`Target Database: ${dbname}`)
  logger.log(`Target Bucket  : ${bucketName}`)
  logger.log(`Mode           : ${args.execute ? '🚨 EXECUTE (DESTRUCTIVE)' : '🔍 DRY-RUN (PLAN ONLY)'}`)
  logger.log('-------------------------------------------------------------\n')

  // ── Safety Guard 1: Refuse Production unless explicitly permitted ──
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && !args.allowProduction) {
    const errMsg = '❌ REFUSED: NODE_ENV is set to production. Destructive reset requires explicit --allow-production-i-understand flag.'
    logger.error(errMsg)
    if (!customPrisma) await prisma.$disconnect()
    throw new Error(errMsg)
  }

  // ── Safety Guard 2: Host Allow-list check ──
  const allowedHostsStr = args.allowedHosts || process.env.RESET_ALLOWED_HOSTS || DEFAULT_ALLOWED_HOSTS.join(',')
  const allowedHosts = allowedHostsStr.split(',').map((h) => h.trim().toLowerCase())
  const isHostAllowed = allowedHosts.includes(host.toLowerCase())

  if (!isHostAllowed) {
    const errMsg = `❌ REFUSED: Database host '${host}' is not in RESET_ALLOWED_HOSTS (${allowedHosts.join(', ')}). Remote/cloud databases (e.g. Supabase) must be added explicitly via RESET_ALLOWED_HOSTS or --allowed-hosts.`
    logger.error(errMsg)
    if (!customPrisma) await prisma.$disconnect()
    throw new Error(errMsg)
  }

  // ── Pre-Execution Table Discovery & Counts ──
  const preCounts = await getTableCounts(prisma)
  const allTables = Object.keys(preCounts)
  const tablesToTruncate = allTables.filter(
    (t) => !PRESERVED_TABLES.includes(t.toLowerCase())
  )

  logger.log('📊 Current Table Inventory:')
  for (const [tbl, cnt] of Object.entries(preCounts)) {
    const isPreserved = PRESERVED_TABLES.includes(tbl.toLowerCase())
    const badge = isPreserved ? ' [PRESERVED]' : ' [WILL TRUNCATE]'
    logger.log(`  - ${tbl.padEnd(24)}: ${String(cnt).padStart(6)} rows${badge}`)
  }

  // ── S3 Inventory ──
  const s3Client = getS3Client()
  const s3Scan = await scanS3Objects(s3Client, bucketName, prefixesToPurge, args.includeUnknownPrefixes)

  logger.log('\n📦 S3 Storage Inventory:')
  if (Object.keys(s3Scan.countsByPrefix).length === 0) {
    logger.log('  No matching objects found in bucket for configured prefixes.')
  } else {
    for (const [prefix, cnt] of Object.entries(s3Scan.countsByPrefix)) {
      logger.log(`  - ${prefix.padEnd(20)}: ${cnt} objects`)
    }
  }

  if (s3Scan.unknownPrefixes.length > 0) {
    logger.log(`  ℹ️  Found ${s3Scan.unknownPrefixes.length} unknown prefix(es): ${s3Scan.unknownPrefixes.join(', ')} (Skipped; pass --include-unknown-prefixes to purge)`)
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  // ── DRY-RUN PATH ──────────────────────────────────────────────────
  if (!args.execute) {
    const planDir = path.resolve(__dirname, '../../../../reports/reset')
    fs.mkdirSync(planDir, { recursive: true })
    const planPath = path.join(planDir, `${timestamp}-plan.json`)

    const plan = {
      timestamp: new Date().toISOString(),
      mode: 'DRY_RUN',
      target: { host, port, dbname, bucket: bucketName },
      preCounts,
      tablesToTruncate,
      tablesPreserved: allTables.filter((t) => PRESERVED_TABLES.includes(t.toLowerCase())),
      s3: {
        bucket: bucketName,
        objectsToPurge: s3Scan.toDelete.length,
        countsByPrefix: s3Scan.countsByPrefix,
        unknownPrefixes: s3Scan.unknownPrefixes,
      },
    }

    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8')
    logger.log(`\n📋 Dry-run plan written to: ${planPath}`)
    logger.log('✨ Dry-run complete. ZERO changes were made. Pass --execute to apply destructive reset.\n')

    if (!customPrisma) await prisma.$disconnect()
    return { status: 'DRY_RUN', planPath, plan }
  }

  // ── Safety Guard 3: Typed Confirmation ──
  const expectedConfirm = `reset ${dbname}`
  if (args.confirm) {
    if (args.confirm.trim() !== expectedConfirm) {
      const errMsg = `❌ REFUSED: Typed confirmation mismatch. Expected '${expectedConfirm}', got '${args.confirm}'.`
      logger.error(errMsg)
      if (!customPrisma) await prisma.$disconnect()
      throw new Error(errMsg)
    }
  } else {
    if (!process.stdin.isTTY) {
      const errMsg = `❌ REFUSED: Non-interactive session requires --confirm "${expectedConfirm}".`
      logger.error(errMsg)
      if (!customPrisma) await prisma.$disconnect()
      throw new Error(errMsg)
    }

    logger.log(`\n⚠️  DESTRUCTIVE ACTION: You are about to permanently delete all non-admin data from host "${host}", database "${dbname}", and S3 bucket "${bucketName}".`)
    const answer = await promptUser(`To confirm, type "${expectedConfirm}": `)
    if (answer !== expectedConfirm) {
      const errMsg = `❌ REFUSED: Confirmation mismatch. Aborted.`
      logger.error(errMsg)
      if (!customPrisma) await prisma.$disconnect()
      throw new Error(errMsg)
    }
  }

  // ── Safety Guard 4: Backup Step ──
  const backupDir = path.resolve(__dirname, '../../../../backups')
  fs.mkdirSync(backupDir, { recursive: true })

  // Always dump Admin and PlatformSetting rows to JSON snapshot
  const adminRows = await prisma.admin.findMany()
  let platformSettingRows = []
  try {
    platformSettingRows = await prisma.platformSetting.findMany()
  } catch {
    platformSettingRows = []
  }

  const adminBackupPath = path.join(backupDir, `${timestamp}-admin.json`)
  fs.writeFileSync(
    adminBackupPath,
    JSON.stringify({ timestamp: new Date().toISOString(), admins: adminRows, platformSettings: platformSettingRows }, null, 2),
    'utf-8'
  )
  logger.log(`\n💾 Preserved models JSON snapshot written to: ${adminBackupPath}`)

  // Database binary dump via pg_dump
  if (!args.noBackup) {
    const dumpPath = path.join(backupDir, `${timestamp}.dump`)
    try {
      logger.log('⏳ Running pg_dump backup...')
      execSync(`pg_dump -Fc "${dbUrl}" -f "${dumpPath}"`, { stdio: 'pipe' })
      logger.log(`✅ Database backup saved to: ${dumpPath}`)
    } catch (err) {
      const errMsg = `❌ REFUSED: Backup via pg_dump failed (${err.message}). If pg_dump is not available, explicitly pass --no-backup to proceed.`
      logger.error(errMsg)
      if (!customPrisma) await prisma.$disconnect()
      throw new Error(errMsg)
    }
  } else {
    logger.warn('⚠️  LOUD WARNING: --no-backup was specified! Skipping pg_dump binary backup.')
  }

  // ── Execution: Dynamic Table Truncation in One Transaction ────────
  logger.log('\n🧹 Truncating non-admin database tables...')
  if (tablesToTruncate.length > 0) {
    const truncateList = tablesToTruncate.map((t) => `"${t}"`).join(', ')
    const truncateSql = `TRUNCATE ${truncateList} RESTART IDENTITY CASCADE;`
    await prisma.$executeRawUnsafe(truncateSql)
    logger.log(`✅ Truncated ${tablesToTruncate.length} tables in a single cascading operation.`)
  }

  // ── Insert Single SYSTEM_RESET AuditLog Row ───────────────────────
  try {
    const insertAuditSql = `
      INSERT INTO "AuditLog" ("id", "userRole", "action", "details", "timestamp")
      VALUES (gen_random_uuid()::text, 'system', 'SYSTEM_RESET', 'Phase P1 data reset executed. Only admin preserved.', NOW());
    `
    await prisma.$executeRawUnsafe(insertAuditSql)
    logger.log('📝 Inserted audit log entry: SYSTEM_RESET')
  } catch (err) {
    logger.warn(`⚠️  Notice: AuditLog insert note: ${err.message}`)
  }

  // ── S3 Purge Execution ────────────────────────────────────────────
  logger.log('\n🪣 Purging S3 object storage...')
  let purgedS3Count = 0
  if (s3Scan.toDelete.length > 0) {
    purgedS3Count = await purgeS3Objects(s3Client, bucketName, s3Scan.toDelete)
    logger.log(`✅ Purged ${purgedS3Count} objects from bucket ${bucketName}`)
  } else {
    logger.log('ℹ️  No S3 objects needed purging.')
  }

  // ── External Stores Purge ─────────────────────────────────────────
  logger.log('\n🔌 Checking auxiliary external stores...')
  const externalReport = await purgeExternalStores(args, logger)

  // ── Post-Condition Verification ───────────────────────────────────
  logger.log('\n🔎 Verifying post-conditions...')
  const postCounts = await getTableCounts(prisma)

  // 1. Admin count must match pre-count
  const preAdmin = preCounts['Admin'] || preCounts['admin'] || 0
  const postAdmin = postCounts['Admin'] || postCounts['admin'] || 0
  if (postAdmin !== preAdmin || postAdmin === 0) {
    const errMsg = `❌ POST-CONDITION FAILED: Admin count changed from ${preAdmin} to ${postAdmin}.`
    logger.error(errMsg)
    if (!customPrisma) await prisma.$disconnect()
    throw new Error(errMsg)
  }

  // 2. All truncated tables must have 0 rows (except AuditLog which must have 1)
  for (const tbl of tablesToTruncate) {
    const cnt = postCounts[tbl] || 0
    if (tbl.toLowerCase() === 'auditlog') {
      if (cnt > 1) {
        throw new Error(`❌ POST-CONDITION FAILED: AuditLog has ${cnt} rows; expected exactly 1 (SYSTEM_RESET).`)
      }
    } else {
      if (cnt !== 0) {
        throw new Error(`❌ POST-CONDITION FAILED: Table '${tbl}' still has ${cnt} rows after reset.`)
      }
    }
  }

  // 3. S3 listing for purged prefixes must be empty
  if (s3Client) {
    const postS3 = await scanS3Objects(s3Client, bucketName, prefixesToPurge, false)
    if (postS3.toDelete.length > 0) {
      throw new Error(`❌ POST-CONDITION FAILED: S3 bucket still contains ${postS3.toDelete.length} objects under purged prefixes.`)
    }
  }

  logger.log('✅ Post-conditions verified successfully:')
  logger.log(`   - Admin rows preserved: ${postAdmin}`)
  logger.log(`   - All ${tablesToTruncate.length} tables cleanly wiped (AuditLog has 1 SYSTEM_RESET entry)`)
  logger.log('   - S3 purged prefixes are completely empty')

  const manifest = {
    timestamp: new Date().toISOString(),
    status: 'COMPLETED',
    target: { host, dbname, bucket: bucketName },
    adminCountPreserved: postAdmin,
    tablesTruncated: tablesToTruncate,
    s3ObjectsPurged: purgedS3Count,
    externalStores: externalReport,
  }

  logger.log('\n📄 Execution Manifest:\n' + JSON.stringify(manifest, null, 2))
  logger.log('\n🎉 Phase P1 Data Reset Complete. Exactly admin accounts preserved.\n')

  if (!customPrisma) await prisma.$disconnect()
  return manifest
}

// ── Direct Execution Entry Point ────────────────────────────────────
if (require.main === module) {
  runReset()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n' + err.message)
      process.exit(1)
    })
}

module.exports = {
  runReset,
  parseArgs,
  parseDatabaseTarget,
  getTableCounts,
  scanS3Objects,
  purgeS3Objects,
  DEFAULT_ALLOWED_HOSTS,
  PRESERVED_TABLES,
}
