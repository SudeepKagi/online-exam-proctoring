/**
 * pendingUploads.js
 * R4 / R-06 / R-07 — Server-issued upload key registry and existence verification.
 *
 * Ensures:
 * 1. Only keys issued by the server with a random suffix for that specific student are accepted.
 * 2. Uploaded object actually exists in S3 storage before accepting enrollment.
 */

'use strict'

const { prisma } = require('../../infra/postgres/client')
const { headObject } = require('../../infra/s3/s3.client')
const { ValidationError, ForbiddenError } = require('../../shared/errors')
const { logger } = require('../../shared/logging')

class PendingUploadRegistry {
  constructor() {
    this._tableInitialized = false
    // Memory fallback if table migration is pending
    this._memoryRegistry = new Map() // key -> { studentId, purpose, expiresAt, status }
  }

  async _ensureTable() {
    if (this._tableInitialized) return
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS pending_uploads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT NOT NULL UNIQUE,
          student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          purpose VARCHAR(64) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          expires_at TIMESTAMPTZ NOT NULL
        )
      `)
      try {
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_pending_uploads_lookup ON pending_uploads(student_id, key, status)`)
      } catch (idxErr) {
        logger.debug({ error: idxErr.message }, 'idx_pending_uploads_lookup index notice')
      }
      this._tableInitialized = true
    } catch (err) {
      logger.warn({ error: err.message }, 'pending_uploads table initialization deferred')
    }
  }

  async recordPendingUpload({ key, studentId, purpose, ttlSeconds = 600 }) {
    await this._ensureTable()
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)

    // In-memory record
    this._memoryRegistry.set(key, {
      studentId,
      purpose,
      expiresAt: expiresAt.getTime(),
      status: 'PENDING'
    })

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO pending_uploads (key, student_id, purpose, status, created_at, expires_at)
        VALUES ($1, $2::uuid, $3, 'PENDING', now(), $4)
        ON CONFLICT (key) DO UPDATE
        SET status = 'PENDING', expires_at = $4;
      `, key, studentId, purpose, expiresAt)
    } catch (err) {
      logger.warn({ error: err.message, key }, 'Could not persist pending_upload row, using memory registry')
    }

    return { key, expiresAt }
  }

  /**
   * Verify server issuance (R-06) and physical storage existence (R-07)
   */
  async verifyAndConsumeUpload({ key, studentId, purpose }) {
    await this._ensureTable()

    // 1. Check DB issuance
    let valid = false
    let recordPurpose = null
    try {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT id, student_id AS "studentId", purpose, status, expires_at AS "expiresAt"
        FROM pending_uploads
        WHERE key = $1 AND student_id = $2::uuid AND status = 'PENDING' AND expires_at > now();
      `, key, studentId)

      if (rows && rows.length > 0) {
        valid = true
        recordPurpose = rows[0].purpose
      }
    } catch (err) {
      logger.debug({ error: err.message }, 'DB pending_uploads lookup failed, falling back to memory')
    }

    // Fallback to in-memory check
    if (!valid) {
      const mem = this._memoryRegistry.get(key)
      if (mem && mem.studentId === studentId && mem.status === 'PENDING' && mem.expiresAt > Date.now()) {
        valid = true
        recordPurpose = mem.purpose
      }
    }

    if (!valid) {
      throw new ForbiddenError(
        `Invalid or unissued upload key '${key}'. Direct uploads accept only single-use keys issued by the server for this student.`
      )
    }

    if (purpose && recordPurpose && recordPurpose.toUpperCase() !== purpose.toUpperCase()) {
      throw new ForbiddenError(
        `Upload purpose mismatch for key '${key}'. Issued for '${recordPurpose}', cannot consume for '${purpose}'.`
      )
    }

    // 2. R-07: Verify object physically exists in storage (HeadObject)
    try {
      const exists = await headObject(key)
      if (!exists) {
        throw new ValidationError(`Object '${key}' was not found in storage. Direct upload to S3 must complete before finalizing.`)
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err
      // If S3 check fails or throws, reject unverified key
      throw new ValidationError(`Storage verification failed for key '${key}': ${err.message}`)
    }

    // 3. Mark consumed (idempotency guard)
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE pending_uploads
        SET status = 'CONSUMED'
        WHERE key = $1;
      `, key)
    } catch (err) {
      logger.warn({ error: err.message, key }, 'Failed to mark pending upload consumed in DB')
    }

    const mem = this._memoryRegistry.get(key)
    if (mem) {
      mem.status = 'CONSUMED'
    }

    return true
  }
}

const pendingUploadRegistry = new PendingUploadRegistry()

module.exports = {
  pendingUploadRegistry,
  PendingUploadRegistry
}
