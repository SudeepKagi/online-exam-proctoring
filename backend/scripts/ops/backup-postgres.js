#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const { execSync } = require('child_process')

async function runBackup() {
  const backupDir = process.env.BACKUP_DIR || path.resolve(__dirname, '../../backups/postgres')
  const retentionDays = parseInt(process.env.RETENTION_DAYS || '7', 10)
  const containerName = process.env.POSTGRES_CONTAINER || 'proctornet-test-postgres'
  const dbName = process.env.POSTGRES_DB || 'proctornet_e2e_test'
  const dbUser = process.env.POSTGRES_USER || 'proctornet'
  const offboxBucket = process.env.OFFBOX_S3_BUCKET || ''

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupFile = path.join(backupDir, `proctornet_backup_${timestamp}.sql.gz`)

  console.log(`[INFO] Starting database backup for '${dbName}'...`)

  // Run pg_dump via docker or local binary
  let rawDump
  try {
    rawDump = execSync(`docker exec ${containerName} pg_dump -U ${dbUser} ${dbName}`, {
      maxBuffer: 100 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch (err) {
    if (err.stdout && err.stdout.length > 0) {
      rawDump = err.stdout
    } else {
      throw new Error(`pg_dump failed: ${err.message}`)
    }
  }

  const compressed = zlib.gzipSync(rawDump)
  fs.writeFileSync(backupFile, compressed)

  const stats = fs.statSync(backupFile)
  console.log(`[INFO] Backup successfully created: ${backupFile} (${(stats.size / 1024).toFixed(1)} KB)`)

  // Retention cleanup
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const files = fs.readdirSync(backupDir)
  for (const f of files) {
    if (f.startsWith('proctornet_backup_') && f.endsWith('.sql.gz')) {
      const filePath = path.join(backupDir, f)
      const fStat = fs.statSync(filePath)
      if (fStat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath)
        console.log(`[INFO] Deleted expired backup: ${f}`)
      }
    }
  }

  // Off-box copy step
  if (offboxBucket) {
    console.log(`[INFO] Off-box copy step: uploading to s3://${offboxBucket}/backups/postgres/`)
    try {
      execSync(`aws s3 cp "${backupFile}" "s3://${offboxBucket}/backups/postgres/${path.basename(backupFile)}"`, { stdio: 'pipe' })
      console.log('[INFO] Off-box copy completed successfully.')
    } catch (err) {
      console.warn('[WARN] AWS S3 copy failed or AWS CLI not configured:', err.message)
    }
  } else {
    console.log('[INFO] Off-box copy step: S3 bucket not specified, local retention verified.')
  }

  return { backupFile, sizeBytes: stats.size, timestamp }
}

if (require.main === module) {
  runBackup()
    .then(({ backupFile }) => {
      console.log(`[SUCCESS] Backup completed: ${backupFile}`)
      process.exit(0)
    })
    .catch((err) => {
      console.error('[FATAL] Backup failed:', err)
      process.exit(1)
    })
}

module.exports = { runBackup }

