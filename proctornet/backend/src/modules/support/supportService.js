/**
 * supportService.js
 * R4 — Real persistent support tickets table and administrative resolution service.
 */

'use strict'

const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')
const { ValidationError, NotFoundError } = require('../../shared/errors')

class SupportService {
  constructor() {
    this._tableInitialized = false
  }

  async _ensureTable() {
    if (this._tableInitialized) return
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS support_tickets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
          subject TEXT NOT NULL,
          message TEXT NOT NULL,
          priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
          status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
          admin_response TEXT,
          resolved_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `)
      try {
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_support_tickets_student ON support_tickets(student_id)`)
      } catch (idxErr) {
        logger.debug({ error: idxErr.message }, 'idx_support_tickets_student index notice')
      }
      try {
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)`)
      } catch (idxErr) {
        logger.debug({ error: idxErr.message }, 'idx_support_tickets_status index notice')
      }
      this._tableInitialized = true
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to create support_tickets table, will retry')
    }
  }

  async createTicket(studentId, { subject, message, priority = 'MEDIUM', examId = null }) {
    await this._ensureTable()

    if (!subject || !subject.trim()) {
      throw new ValidationError('Subject is required')
    }
    if (!message || !message.trim()) {
      throw new ValidationError('Message is required')
    }

    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO support_tickets (student_id, exam_id, subject, message, priority, status, created_at, updated_at)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'OPEN', now(), now())
      RETURNING id, student_id AS "studentId", exam_id AS "examId", subject, message, priority, status, created_at AS "createdAt";
    `, studentId, examId || null, subject.trim(), message.trim(), priority)

    return {
      success: true,
      ticket: rows[0]
    }
  }

  async listTicketsForStudent(studentId) {
    await this._ensureTable()

    const rows = await prisma.$queryRawUnsafe(`
      SELECT 
        id, 
        student_id AS "studentId", 
        exam_id AS "examId", 
        subject, 
        message, 
        priority, 
        status, 
        admin_response AS "adminResponse", 
        resolved_at AS "resolvedAt", 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
      FROM support_tickets
      WHERE student_id = $1::uuid
      ORDER BY created_at DESC;
    `, studentId)

    return rows || []
  }

  async listAllTickets(statusFilter = null) {
    await this._ensureTable()

    let query = `
      SELECT 
        t.id, 
        t.student_id AS "studentId", 
        s.name AS "studentName",
        s.usn AS "studentUsn",
        t.exam_id AS "examId", 
        e.title AS "examTitle",
        t.subject, 
        t.message, 
        t.priority, 
        t.status, 
        t.admin_response AS "adminResponse", 
        t.resolved_at AS "resolvedAt", 
        t.created_at AS "createdAt", 
        t.updated_at AS "updatedAt"
      FROM support_tickets t
      JOIN students s ON t.student_id = s.id
      LEFT JOIN exams e ON t.exam_id = e.id
    `

    const params = []
    if (statusFilter) {
      query += ` WHERE t.status = $1`
      params.push(statusFilter)
    }

    query += ` ORDER BY t.created_at DESC LIMIT 200;`

    const rows = await prisma.$queryRawUnsafe(query, ...params)
    return rows || []
  }

  async resolveTicket(ticketId, { status = 'RESOLVED', adminResponse = '' }) {
    await this._ensureTable()

    const rows = await prisma.$queryRawUnsafe(`
      UPDATE support_tickets
      SET status = $1,
          admin_response = $2,
          resolved_at = now(),
          updated_at = now()
      WHERE id = $3::uuid
      RETURNING id, student_id AS "studentId", subject, status, admin_response AS "adminResponse", resolved_at AS "resolvedAt";
    `, status, adminResponse, ticketId)

    if (!rows || rows.length === 0) {
      throw new NotFoundError(`Ticket ${ticketId} not found`)
    }

    return {
      success: true,
      ticket: rows[0]
    }
  }
}

const supportService = new SupportService()

module.exports = {
  supportService,
  SupportService
}
