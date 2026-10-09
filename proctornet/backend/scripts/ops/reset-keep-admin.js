#!/usr/bin/env node
'use strict'

/**
 * ProctorNet Admin-Only Database & Storage Reset Tool (§Prompt 7 T3)
 *
 * Enforces:
 * 1. Strict schema table classification from Prisma DMMF:
 *    - KEEP_IDENTITY: 'admins'
 *    - KEEP_CONFIG: 'platform_settings', 'departments', 'agent_rules', 'agent_policy_versions', 'agent_releases', '_prisma_migrations'
 *    - RESET_LEASES: 'vpn_ip_pool'
 *    - WIPE: all candidate data, attempts, telemetry, logs, sessions, findings
 * 2. Single-transaction TRUNCATE of WIPE tables with transactional post-condition validation.
 *    On any failure/mismatch -> instant ROLLBACK.
 * 3. Exact current audit log schema row written: SYSTEM_RESET.
 * 4. Auth session invalidation: bump auth_epoch in platform_settings and wipe auth_sessions.
 * 5. Bounded S3 prefix purging through S3Adapter (identity/, evidence/, live/, thumbs/, uploads/, attempts/).
 *    NEVER touches agent/, releases/, backups/. Handles versioned objects.
 * 6. Production safety envelope: dry-run default, --backup-ref, active attempt rejection, confirmation token,
 *    and parameterized pg_dump via execFile with PG* env vars.
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')
const { PrismaClient } = require('@prisma/client')
const { validateClassificationIntegrity } = require('./tableClassification')
const { tokenService } = require('../../src/modules/auth/tokenService')
const { AwsS3Adapter, MemoryS3Adapter } = require('../../src/infra/s3/s3Adapter')
const config = require('../../src/shared/config')
const { logger } = require('../../src/shared/logging')

const ALLOWED_PURGE_PREFIXES = [
  'identity/',
  'evidence/',
  'live/',
  'thumbs/',
  'uploads/',
  'attempts/'
]

const FORBIDDEN_PURGE_PREFIXES = [
  'agent/',
  'releases/',
  'backups/'
]

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    execute: false,
    allowProduction: false,
    confirm: null,
    backupRef: null,
    storageAdapter: null,
    maintenance: false,
    createBackup: false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--execute') args.execute = true
    else if (arg === '--allow-production-i-understand') args.allowProduction = true
    else if (arg === '--confirm' && argv[i + 1]) args.confirm = argv[++i]
    else if (arg === '--backup-ref' && argv[i + 1]) args.backupRef = argv[++i]
    else if (arg === '--maintenance') args.maintenance = true
    else if (arg === '--create-backup') args.createBackup = true
  }

  return args
}

function parseDbInfo(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not set')
  const cleanUrl = url.trim().replace(/^["']|["']$/g, '')
  const parsed = new URL(cleanUrl)
  const host = parsed.hostname.toLowerCase()
  const port = parsed.port || '5432'
  const user = decodeURIComponent(parsed.username || 'postgres')
  const password = decodeURIComponent(parsed.password || '')
  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0]
  const isLocal = ['localhost', '127.0.0.1', 'postgres', 'postgres-test'].includes(host)

  return { host, port, user, password, dbName, isLocal, cleanUrl }
}

async function runPgDump(dbInfo, outputPath) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PGHOST: dbInfo.host,
      PGPORT: dbInfo.port,
      PGUSER: dbInfo.user,
      PGPASSWORD: dbInfo.password,
      PGDATABASE: dbInfo.dbName
    }

    const args = [
      '--no-owner',
      '--no-privileges',
      '--clean',
      '--if-exists',
      '--file', outputPath
    ]

    execFile('pg_dump', args, { env }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`pg_dump failed: ${error.message} - ${stderr}`))
      }
      resolve({ stdout, stderr, outputPath })
    })
  })
}

async function purgeS3Storage(storageAdapter, bucket, dryRun = true) {
  const summary = {
    purgedKeys: 0,
    purgedVersions: 0,
    skippedPrefixes: [],
    prefixes: ALLOWED_PURGE_PREFIXES
  }

  if (dryRun) {
    logger.info('[DRY-RUN] S3 storage purge evaluated for prefixes: %j', ALLOWED_PURGE_PREFIXES)
    return summary
  }

  for (const prefix of ALLOWED_PURGE_PREFIXES) {
    // Check safety guard against forbidden prefixes
    for (const forbidden of FORBIDDEN_PURGE_PREFIXES) {
      if (prefix.startsWith(forbidden)) {
        throw new Error(`CRITICAL: Attempted to purge protected S3 prefix: ${prefix}`)
      }
    }

    // List and delete versions/delete markers if bucket is versioned
    try {
      let keyMarker = null
      let versionIdMarker = null
      do {
        const verRes = await storageAdapter.listObjectVersions(prefix, keyMarker, versionIdMarker, 1000)
        const toDelete = []
        if (verRes.Versions && verRes.Versions.length > 0) {
          for (const v of verRes.Versions) {
            toDelete.push({ Key: v.Key, VersionId: v.VersionId })
          }
        }
        if (verRes.DeleteMarkers && verRes.DeleteMarkers.length > 0) {
          for (const m of verRes.DeleteMarkers) {
            toDelete.push({ Key: m.Key, VersionId: m.VersionId })
          }
        }

        if (toDelete.length > 0) {
          await storageAdapter.deleteObjectVersions(toDelete)
          summary.purgedVersions += toDelete.length
        }

        if (verRes.IsTruncated) {
          keyMarker = verRes.NextKeyMarker
          versionIdMarker = verRes.NextVersionIdMarker
        } else {
          keyMarker = null
        }
      } while (keyMarker)
    } catch (_) {
      // Bucket may not have versioning enabled, fall back to standard list
    }

    // List and delete regular objects
    let continuationToken = null
    do {
      const objRes = await storageAdapter.listObjects(prefix, continuationToken, 1000)
      if (objRes.Contents && objRes.Contents.length > 0) {
        const keys = objRes.Contents.map(c => c.Key)
        await storageAdapter.deleteObjects(keys)
        summary.purgedKeys += keys.length
      }
      continuationToken = objRes.IsTruncated ? objRes.NextContinuationToken : null
    } while (continuationToken)

    // Verify empty after purge
    const checkRes = await storageAdapter.listObjects(prefix, null, 1)
    if (checkRes.Contents && checkRes.Contents.length > 0) {
      throw new Error(`Post-condition failed: S3 prefix "${prefix}" not empty after purge!`)
    }
  }

  summary.totalPurged = summary.purgedKeys + summary.purgedVersions
  return summary
}

async function executeDatabaseReset(prisma, options = {}) {
  const {
    dryRun = true,
    storageAdapter = null,
    backupRef = null
  } = options

  const classification = validateClassificationIntegrity()
  const { keepIdentity, keepConfig, resetLeases, wipe } = classification

  logger.info('=== ProctorNet Data Reset Engine (§T3) ===')
  logger.info(`Mode: ${dryRun ? 'DRY-RUN (Simulated)' : 'EXECUTE (Destructive)'}`)
  logger.info(`Preserved Identity Tables: ${keepIdentity.join(', ')}`)
  logger.info(`Preserved Config Tables: ${keepConfig.join(', ')}`)
  logger.info(`Reset Leases Tables: ${resetLeases.join(', ')}`)
  logger.info(`Tables to Wipe (${wipe.length}): ${wipe.join(', ')}`)

  // 1. Initial State Counts
  const initialAdminCount = await prisma.admin.count()
  if (initialAdminCount < 1) {
    throw new Error('Pre-condition failed: At least 1 Admin account must exist in the database')
  }

  // Check for active exam attempts: REFUSE if any attempt is ACTIVE
  const activeAttempts = await prisma.examAttempt.count({ where: { status: 'ACTIVE' } })
  if (activeAttempts > 0) {
    throw new Error(`Pre-condition failed: Cannot reset database while ${activeAttempts} exam attempt(s) are ACTIVE!`)
  }

  const initialConfigCounts = new Map()
  for (const tbl of keepConfig) {
    try {
      const [{ count }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${tbl}"`)
      initialConfigCounts.set(tbl, count)
    } catch (_) {
      // Table might not exist yet if not migrated
    }
  }

  const wipeCounts = new Map()
  for (const tbl of wipe) {
    try {
      const [{ count }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${tbl}"`)
      wipeCounts.set(tbl, count)
    } catch (_) {
      wipeCounts.set(tbl, 0)
    }
  }

  logger.info('Pre-Reset Table Status:')
  logger.info(`- Admins: ${initialAdminCount}`)
  for (const [tbl, cnt] of initialConfigCounts.entries()) {
    logger.info(`- [KEEP_CONFIG] ${tbl}: ${cnt} rows`)
  }
  let totalWipeRows = 0
  for (const [tbl, cnt] of wipeCounts.entries()) {
    totalWipeRows += cnt
    if (cnt > 0) logger.info(`- [WIPE] ${tbl}: ${cnt} rows`)
  }
  logger.info(`Total candidate / telemetry rows to wipe: ${totalWipeRows}`)

  if (dryRun) {
    logger.info('[DRY-RUN] No database modifications performed.')
    return {
      dryRun: true,
      classification,
      initialAdminCount,
      totalWipeRows,
      backupRef
    }
  }

  // 2. Execute Single Atomic Transaction
  logger.info('Executing atomic database wipe transaction...')
  await prisma.$transaction(async (tx) => {
    // A. Truncate all WIPE tables in one command
    const quotedWipeTables = wipe.map(t => `"${t}"`).join(', ')
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${quotedWipeTables} CASCADE;`)

    // B. Reset leases on vpn_ip_pool
    await tx.$executeRawUnsafe(`
      UPDATE vpn_ip_pool
      SET status = 'AVAILABLE',
          allocated_to = NULL,
          attempt_id = NULL,
          allocated_at = NULL,
          last_heartbeat = NULL,
          lease_expires_at = NULL;
    `)

    // C. Write exact single SYSTEM_RESET row into audit_logs
    await tx.$executeRawUnsafe(`
      INSERT INTO audit_logs (actor_role, action, metadata, timestamp)
      VALUES (
        'SYSTEM',
        'SYSTEM_RESET',
        jsonb_build_object(
          'reason', 'ops_reset_keep_admin',
          'backupRef', '${backupRef || 'unspecified'}',
          'wipedTablesCount', ${wipe.length},
          'resetAt', now()::text
        ),
        now()
      );
    `)

    // D. Post-Condition Assertions inside transaction before COMMIT
    // 1. Admins unchanged and >= 1
    const [{ postAdminCount }] = await tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS "postAdminCount" FROM "admins"`)
    if (postAdminCount !== initialAdminCount || postAdminCount < 1) {
      throw new Error(`POST-CONDITION FAILED: Admins count changed (was ${initialAdminCount}, now ${postAdminCount})`)
    }

    // 2. Keep Config counts unchanged
    for (const [tbl, initialCnt] of initialConfigCounts.entries()) {
      const [{ cnt }] = await tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS cnt FROM "${tbl}"`)
      if (cnt !== initialCnt) {
        throw new Error(`POST-CONDITION FAILED: Keep config table "${tbl}" count changed (was ${initialCnt}, now ${cnt})`)
      }
    }

    // 3. WIPE tables must have 0 rows (except audit_logs which must have exactly 1 SYSTEM_RESET row)
    for (const tbl of wipe) {
      const [{ cnt }] = await tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS cnt FROM "${tbl}"`)
      if (tbl === 'audit_logs') {
        if (cnt !== 1) {
          throw new Error(`POST-CONDITION FAILED: audit_logs must contain exactly 1 SYSTEM_RESET row, found ${cnt}`)
        }
      } else {
        if (cnt !== 0) {
          throw new Error(`POST-CONDITION FAILED: Table "${tbl}" was not wiped; found ${cnt} rows`)
        }
      }
    }

    // 4. vpn_ip_pool has 0 allocated IPs
    const [{ allocatedIps }] = await tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS "allocatedIps" FROM "vpn_ip_pool" WHERE status != 'AVAILABLE'`)
    if (allocatedIps !== 0) {
      throw new Error(`POST-CONDITION FAILED: vpn_ip_pool has ${allocatedIps} allocated leases remaining`)
    }
  }, {
    timeout: 30000,
    maxWait: 5000
  })

  logger.info('✓ Database transaction committed successfully.')

  // 3. Bump auth_epoch to invalidate all existing cookies & tokens
  logger.info('Invalidating authentication epoch across all clients...')
  const nextEpoch = await tokenService.bumpAuthEpoch('SYSTEM')
  logger.info(`✓ Global auth_epoch advanced to ${nextEpoch}.`)

  // 4. S3 Storage Purge
  let s3Summary = null
  if (storageAdapter) {
    logger.info('Purging S3 storage buckets...')
    s3Summary = await purgeS3Storage(storageAdapter, config.s3Bucket, false)
    logger.info(`✓ S3 Storage purged: ${s3Summary.purgedKeys} keys, ${s3Summary.purgedVersions} versions removed.`)
  }

  return {
    success: true,
    dryRun: false,
    initialAdminCount,
    totalWipeRows,
    nextEpoch,
    s3Summary,
    backupRef,
    timestamp: new Date().toISOString()
  }
}

async function main() {
  const args = parseArgs()
  const dbInfo = parseDbInfo()
  const prisma = new PrismaClient()

  try {
    // Production Safety Checks
    if (!dbInfo.isLocal && args.execute && !args.allowProduction) {
      console.error('\n[SAFETY REFUSAL] Target database is non-local (production/remote).')
      console.error('You must explicitly supply --allow-production-i-understand to proceed.')
      process.exit(1)
    }

    if (args.execute) {
      const expectedConfirm = `reset ${dbInfo.dbName}`
      if (args.confirm !== expectedConfirm) {
        console.error(`\n[CONFIRMATION REFUSAL] Must provide exact confirmation token: --confirm "${expectedConfirm}"`)
        process.exit(1)
      }

      if (!args.backupRef) {
        if (args.createBackup) {
          const reportDir = path.resolve(__dirname, '../../../reports/reset')
          if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })
          const backupFile = path.join(reportDir, `pre-reset-backup-${Date.now()}.sql`)
          console.log(`Generating pre-reset pg_dump backup to ${backupFile}...`)
          await runPgDump(dbInfo, backupFile)
          args.backupRef = backupFile
          console.log(`✓ Backup created: ${backupFile}`)
        } else {
          console.error('\n[SAFETY REFUSAL] --backup-ref <rds-snapshot-id|s3-dump-key|file-path> is required for --execute.')
          console.error('Pass --create-backup to automatically run a local pg_dump before reset.')
          process.exit(1)
        }
      }
    }

    // Default Storage Adapter using AWS default chain / instance role
    const storageAdapter = new AwsS3Adapter({
      bucket: config.s3Bucket,
      region: config.s3Region
    })

    const result = await executeDatabaseReset(prisma, {
      dryRun: !args.execute,
      storageAdapter,
      backupRef: args.backupRef
    })

    // Write reset manifest to reports/reset/
    const reportsDir = path.resolve(__dirname, '../../../reports/reset')
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true })
    const manifestFile = path.join(reportsDir, `manifest-${Date.now()}.json`)
    fs.writeFileSync(manifestFile, JSON.stringify(result, null, 2))
    logger.info(`Reset manifest recorded to: ${manifestFile}`)

    if (!args.execute) {
      console.log('\n[DRY-RUN COMPLETE] Pre-conditions and table classifications verified cleanly.')
      console.log('To execute real destruction, run with:')
      console.log(`  node scripts/ops/reset-keep-admin.js --execute --confirm "reset ${dbInfo.dbName}" --backup-ref <id> ${dbInfo.isLocal ? '' : '--allow-production-i-understand'}\n`)
    } else {
      console.log('\n[RESET SUCCESS] Database wiped and admin account preserved cleanly.\n')
    }
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\n[RESET ERROR]', err.message)
    process.exit(1)
  })
}

module.exports = {
  executeDatabaseReset,
  purgeS3Storage,
  parseArgs,
  parseDbInfo,
  ALLOWED_PURGE_PREFIXES,
  FORBIDDEN_PURGE_PREFIXES
}
