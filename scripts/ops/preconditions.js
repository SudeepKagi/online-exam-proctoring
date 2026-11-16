'use strict'

/**
 * scripts/ops/preconditions.js
 * Pure modular functions for deployment safety checks.
 * Used by deploy-prod.js, rollback-prod.js, and automated unit tests.
 */

const DESTRUCTIVE_SQL_PATTERNS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\s+TABLE\s+.*\s+DROP\b/i
]

/**
 * Validates available disk space on the target machine.
 *
 * @param {number} availableMb - Free space in megabytes
 * @param {number} [thresholdMb=2000] - Minimum acceptable free space (default 2000 MB)
 * @returns {{ ok: boolean, availableMb: number, thresholdMb: number, message: string }}
 */
function checkDiskSpace(availableMb, thresholdMb = 2000) {
  if (typeof availableMb !== 'number' || Number.isNaN(availableMb)) {
    throw new Error('Invalid availableMb argument: must be a number')
  }
  const ok = availableMb >= thresholdMb
  return {
    ok,
    availableMb,
    thresholdMb,
    message: ok
      ? `Disk space check passed: ${availableMb} MB free (threshold: ${thresholdMb} MB)`
      : `Disk space check failed: ${availableMb} MB free is below ${thresholdMb} MB threshold`
  }
}

/**
 * Validates that the pre-deployment database backup was created recently.
 *
 * @param {number|Date|string} backupTimestamp - Timestamp of backup file
 * @param {number} [maxAgeMinutes=30] - Maximum acceptable age in minutes
 * @param {number} [currentTimestamp=Date.now()] - Current epoch ms (injectable for testing)
 * @returns {{ ok: boolean, ageMinutes: number, maxAgeMinutes: number, message: string }}
 */
function checkBackupFreshness(backupTimestamp, maxAgeMinutes = 30, currentTimestamp = Date.now()) {
  if (!backupTimestamp) {
    throw new Error('Backup timestamp is required')
  }
  const backupEpoch = typeof backupTimestamp === 'number'
    ? backupTimestamp
    : new Date(backupTimestamp).getTime()

  if (Number.isNaN(backupEpoch)) {
    throw new Error('Invalid backup timestamp format')
  }

  const ageMs = currentTimestamp - backupEpoch
  const ageMinutes = Math.max(0, Math.floor(ageMs / (60 * 1000)))
  const ok = ageMinutes <= maxAgeMinutes

  return {
    ok,
    ageMinutes,
    maxAgeMinutes,
    message: ok
      ? `Backup freshness check passed: ${ageMinutes}m old (threshold: < ${maxAgeMinutes}m)`
      : `Backup freshness check failed: backup is ${ageMinutes}m old, exceeding ${maxAgeMinutes}m threshold`
  }
}

/**
 * Validates that no student exams are currently actively IN_PROGRESS during cutover.
 *
 * @param {number} inProgressCount - Count of currently in-progress attempts
 * @param {boolean} [allowForce=false] - Whether to allow cutover despite active attempts
 * @returns {{ ok: boolean, inProgressCount: number, message: string }}
 */
function checkActiveAttempts(inProgressCount, allowForce = false) {
  if (typeof inProgressCount !== 'number' || inProgressCount < 0) {
    throw new Error('Invalid inProgressCount: must be a non-negative number')
  }
  const ok = inProgressCount === 0 || allowForce
  return {
    ok,
    inProgressCount,
    message: ok
      ? inProgressCount === 0
        ? 'Active attempts check passed: 0 active student exam attempts'
        : `Active attempts override active: proceeding with ${inProgressCount} in-progress attempts`
      : `Active attempts check failed: ${inProgressCount} student exams are currently IN_PROGRESS`
  }
}

/**
 * Validates that all pending migrations are strictly additive (no destructive operations).
 *
 * @param {Array<{ name: string, sql: string }>} migrations - Migration files and SQL text
 * @returns {{ ok: boolean, destructive: Array<{ name: string, pattern: string }>, message: string }}
 */
function checkMigrationsAdditive(migrations = []) {
  const destructive = []

  for (const m of migrations) {
    const sql = m.sql || ''
    for (const pattern of DESTRUCTIVE_SQL_PATTERNS) {
      if (pattern.test(sql)) {
        destructive.push({ name: m.name, pattern: pattern.toString() })
      }
    }
  }

  const ok = destructive.length === 0
  return {
    ok,
    destructive,
    message: ok
      ? `Migration audit passed: ${migrations.length} migration(s) verified as strictly additive`
      : `Migration audit failed: ${destructive.length} destructive pattern(s) detected: ${JSON.stringify(destructive)}`
  }
}

/**
 * Validates that the local git working tree is clean.
 *
 * @param {string} gitStatusOutput - Output of `git status --porcelain`
 * @returns {{ ok: boolean, uncommittedCount: number, message: string }}
 */
function checkWorkingTreeClean(gitStatusOutput = '') {
  const lines = gitStatusOutput
    .trim()
    .split('\n')
    .filter((l) => l.trim().length > 0)
  const ok = lines.length === 0
  return {
    ok,
    uncommittedCount: lines.length,
    message: ok
      ? 'Git working tree is clean'
      : `Git working tree has ${lines.length} uncommitted change(s)`
  }
}

module.exports = {
  checkDiskSpace,
  checkBackupFreshness,
  checkActiveAttempts,
  checkMigrationsAdditive,
  checkWorkingTreeClean,
  DESTRUCTIVE_SQL_PATTERNS
}
