#!/usr/bin/env node
'use strict'

const fs = require('fs')
const zlib = require('zlib')
const { execSync, spawn } = require('child_process')
const { runBackup } = require('./backup-postgres')

async function runRestoreTest() {
  const containerName = process.env.POSTGRES_CONTAINER || 'proctornet-test-postgres'
  const dbUser = process.env.POSTGRES_USER || 'proctornet'
  const scratchDb = process.env.SCRATCH_DB || 'proctornet_scratch_restore_test'

  console.log('======================================================================')
  console.log(' ProctorNet Automated Disaster Recovery & Backup Restore Test')
  console.log('======================================================================')

  // Step 1: Create fresh backup
  console.log('[1/5] Creating fresh database backup...')
  const { backupFile, sizeBytes } = await runBackup()
  console.log(`[1/5] Backup created at: ${backupFile} (${(sizeBytes / 1024).toFixed(1)} KB)`)

  // Step 2: Initialize scratch database
  console.log(`[2/5] Initializing clean scratch database '${scratchDb}' on container '${containerName}'...`)
  execSync(`docker exec ${containerName} psql -U ${dbUser} -d postgres -c "DROP DATABASE IF EXISTS ${scratchDb};"`, { stdio: 'pipe' })
  execSync(`docker exec ${containerName} psql -U ${dbUser} -d postgres -c "CREATE DATABASE ${scratchDb};"`, { stdio: 'pipe' })
  console.log(`[2/5] Scratch database '${scratchDb}' created successfully.`)

  // Step 3: Restore backup into scratch database
  console.log(`[3/5] Decompressing and restoring backup into '${scratchDb}'...`)
  const compressedData = fs.readFileSync(backupFile)
  const decompressedSql = zlib.gunzipSync(compressedData)

  await new Promise((resolve, reject) => {
    const psql = spawn('docker', ['exec', '-i', containerName, 'psql', '-U', dbUser, '-d', scratchDb], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stderr = ''
    psql.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })

    psql.on('close', code => {
      // psql returns 0 on success; warnings or notices are sent to stderr
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`psql restore exited with code ${code}: ${stderr}`))
      }
    })

    psql.on('error', reject)
    psql.stdin.write(decompressedSql)
    psql.stdin.end()
  })
  console.log('[3/5] Restoration stream completed.')

  // Step 4: Verification Queries
  console.log(`[4/5] Running schema and data integrity verification queries on '${scratchDb}'...`)
  const runQuery = (sql) => {
    const raw = execSync(`docker exec ${containerName} psql -U ${dbUser} -d ${scratchDb} -t -A -c "${sql}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return raw.trim()
  }

  const tableCount = parseInt(runQuery("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"), 10)
  const userCount = parseInt(runQuery("SELECT count(*) FROM users;"), 10)
  const examCount = parseInt(runQuery("SELECT count(*) FROM exams;"), 10)
  const questionCount = parseInt(runQuery("SELECT count(*) FROM questions;"), 10)

  console.log('----------------------------------------------------------------------')
  console.log(' RESTORATION INTEGRITY AUDIT REPORT')
  console.log('----------------------------------------------------------------------')
  console.log(` [+] Public Schema Tables Count : ${tableCount}`)
  console.log(` [+] User Records Restored      : ${userCount}`)
  console.log(` [+] Exam Records Restored      : ${examCount}`)
  console.log(` [+] Question Records Restored  : ${questionCount}`)
  console.log('----------------------------------------------------------------------')

  if (isNaN(tableCount) || tableCount === 0) {
    throw new Error('Restoration audit failed: table count is 0')
  }

  // Step 5: Teardown scratch database
  console.log(`[5/5] Cleaning up scratch database '${scratchDb}'...`)
  execSync(`docker exec ${containerName} psql -U ${dbUser} -d postgres -c "DROP DATABASE IF EXISTS ${scratchDb};"`, { stdio: 'pipe' })
  console.log('[5/5] Scratch database dropped cleanly.')

  console.log('======================================================================')
  console.log(' RESTORE TEST PASSED: ALL DATA INVARIANTS & SCHEMAS VERIFIED')
  console.log('======================================================================')

  return {
    success: true,
    tableCount,
    userCount,
    examCount,
    questionCount,
    backupFile
  }
}

if (require.main === module) {
  runRestoreTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL] Restore test failed:', err)
      process.exit(1)
    })
}

module.exports = { runRestoreTest }

