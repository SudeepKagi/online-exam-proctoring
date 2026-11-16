'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')

const {
  checkDiskSpace,
  checkBackupFreshness,
  checkActiveAttempts,
  checkMigrationsAdditive,
  checkWorkingTreeClean
} = require('../../scripts/ops/preconditions')

describe('Deployment Precondition Safety Checks', () => {
  describe('checkDiskSpace()', () => {
    it('passes when free disk space exceeds threshold (e.g. 5000 MB > 2000 MB)', () => {
      const res = checkDiskSpace(5000, 2000)
      assert.equal(res.ok, true)
      assert.equal(res.availableMb, 5000)
      assert.match(res.message, /passed/i)
    })

    it('passes when free disk space exactly equals threshold (2000 MB)', () => {
      const res = checkDiskSpace(2000, 2000)
      assert.equal(res.ok, true)
    })

    it('fails when free disk space is below threshold (e.g. 1200 MB < 2000 MB)', () => {
      const res = checkDiskSpace(1200, 2000)
      assert.equal(res.ok, false)
      assert.match(res.message, /failed/i)
    })

    it('throws error when argument is not a valid number', () => {
      assert.throws(() => checkDiskSpace('5000'), /Invalid availableMb argument/i)
      assert.throws(() => checkDiskSpace(NaN), /Invalid availableMb argument/i)
    })
  })

  describe('checkBackupFreshness()', () => {
    const now = 1700000000000

    it('passes when backup was created 5 minutes ago (< 30m threshold)', () => {
      const backupTime = now - 5 * 60 * 1000
      const res = checkBackupFreshness(backupTime, 30, now)
      assert.equal(res.ok, true)
      assert.equal(res.ageMinutes, 5)
      assert.match(res.message, /passed/i)
    })

    it('passes when backup was created exactly 30 minutes ago', () => {
      const backupTime = now - 30 * 60 * 1000
      const res = checkBackupFreshness(backupTime, 30, now)
      assert.equal(res.ok, true)
      assert.equal(res.ageMinutes, 30)
    })

    it('fails when backup was created 35 minutes ago (> 30m threshold)', () => {
      const backupTime = now - 35 * 60 * 1000
      const res = checkBackupFreshness(backupTime, 30, now)
      assert.equal(res.ok, false)
      assert.equal(res.ageMinutes, 35)
      assert.match(res.message, /failed/i)
    })

    it('accepts Date objects and ISO strings', () => {
      const dateObj = new Date(now - 10 * 60 * 1000)
      const res1 = checkBackupFreshness(dateObj, 30, now)
      assert.equal(res1.ok, true)
      assert.equal(res1.ageMinutes, 10)

      const isoStr = dateObj.toISOString()
      const res2 = checkBackupFreshness(isoStr, 30, now)
      assert.equal(res2.ok, true)
      assert.equal(res2.ageMinutes, 10)
    })

    it('throws error on missing or invalid timestamp', () => {
      assert.throws(() => checkBackupFreshness(null), /Backup timestamp is required/i)
      assert.throws(() => checkBackupFreshness('invalid-date'), /Invalid backup timestamp format/i)
    })
  })

  describe('checkActiveAttempts()', () => {
    it('passes when there are 0 active attempts', () => {
      const res = checkActiveAttempts(0)
      assert.equal(res.ok, true)
      assert.match(res.message, /0 active student exam attempts/i)
    })

    it('fails when there are active attempts and allowForce is false', () => {
      const res = checkActiveAttempts(3, false)
      assert.equal(res.ok, false)
      assert.match(res.message, /3 student exams are currently IN_PROGRESS/i)
    })

    it('passes when allowForce is true even if attempts are in progress', () => {
      const res = checkActiveAttempts(3, true)
      assert.equal(res.ok, true)
      assert.match(res.message, /override active/i)
    })

    it('throws error on invalid attempt count', () => {
      assert.throws(() => checkActiveAttempts(-1), /Invalid inProgressCount/i)
      assert.throws(() => checkActiveAttempts('3'), /Invalid inProgressCount/i)
    })
  })

  describe('checkMigrationsAdditive()', () => {
    it('passes when migrations only contain additive SQL statements', () => {
      const migrations = [
        {
          name: '0006_exam_drafts',
          sql: `
            CREATE TABLE IF NOT EXISTS "exam_drafts" (
              "id" TEXT NOT NULL,
              "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "exam_drafts_pkey" PRIMARY KEY ("id")
            );
            ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "draft_id" TEXT;
            CREATE INDEX IF NOT EXISTS "exam_drafts_created_at_idx" ON "exam_drafts"("created_at");
          `
        }
      ]
      const res = checkMigrationsAdditive(migrations)
      assert.equal(res.ok, true)
      assert.equal(res.destructive.length, 0)
      assert.match(res.message, /passed/i)
    })

    it('detects and rejects DROP TABLE', () => {
      const migrations = [
        {
          name: 'destructive_migration_1',
          sql: 'DROP TABLE "legacy_data";'
        }
      ]
      const res = checkMigrationsAdditive(migrations)
      assert.equal(res.ok, false)
      assert.ok(res.destructive.length >= 1)
      assert.match(res.message, /destructive pattern\(s\) detected/i)
    })

    it('detects and rejects DROP COLUMN', () => {
      const migrations = [
        {
          name: 'destructive_migration_2',
          sql: 'ALTER TABLE "users" DROP COLUMN "old_field";'
        }
      ]
      const res = checkMigrationsAdditive(migrations)
      assert.equal(res.ok, false)
      assert.ok(res.destructive.length >= 1)
    })

    it('detects and rejects TRUNCATE', () => {
      const migrations = [
        {
          name: 'destructive_migration_3',
          sql: 'TRUNCATE TABLE "audit_logs";'
        }
      ]
      const res = checkMigrationsAdditive(migrations)
      assert.equal(res.ok, false)
    })
  })

  describe('checkWorkingTreeClean()', () => {
    it('passes when git status output is empty', () => {
      const res = checkWorkingTreeClean('')
      assert.equal(res.ok, true)
      assert.equal(res.uncommittedCount, 0)
    })

    it('fails when git status output contains uncommitted files', () => {
      const statusOutput = ' M frontend/src/App.jsx\n?? new-file.txt\n'
      const res = checkWorkingTreeClean(statusOutput)
      assert.equal(res.ok, false)
      assert.equal(res.uncommittedCount, 2)
      assert.match(res.message, /2 uncommitted change\(s\)/i)
    })
  })
})
