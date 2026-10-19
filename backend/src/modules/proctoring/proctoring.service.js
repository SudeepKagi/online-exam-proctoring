'use strict'

const proctoringSql = require('./proctoring.sql')
const { socketEmitter } = require('../../infra/websocket/emitter')
const { logger } = require('../../shared/logging')
const { prisma } = require('../../infra/postgres/client')

class ProctoringService {
  constructor(maxBatch = 100, flushIntervalMs = 150) {
    this.buffer = []
    this.maxBatch = maxBatch
    this.flushIntervalMs = flushIntervalMs
    this.timer = null
    this.io = null
  }

  setIO(io) { this.io = io }

  async recordViolation({ attemptId, examId, eventType, severity = 'MEDIUM', metadata = {}, evidenceS3Key = null }) {
    if (!attemptId || !eventType) {
      const err = new Error('attemptId and eventType are required')
      err.status = 400
      throw err
    }

    const snapshotDataUrl = metadata?.snapshotDataUrl || null
    const meta = { ...metadata, ...(snapshotDataUrl ? { snapshotDataUrl } : {}) }

    return new Promise((resolve, reject) => {
      this.buffer.push({
        attemptId, examId, eventType, severity, metadata: meta,
        evidenceS3Key: evidenceS3Key || (snapshotDataUrl ? 'inline-base64' : null),
        resolve, reject
      })

      this.broadcastLiveEvent({ attemptId, examId, eventType, severity, snapshotDataUrl, metadata: meta }).catch(() => {})

      if (this.buffer.length >= this.maxBatch) this.flush()
      else if (!this.timer) this.timer = setTimeout(() => this.flush(), this.flushIntervalMs)
    })
  }

  async broadcastLiveEvent({ attemptId, examId, eventType, severity, snapshotDataUrl, metadata }) {
    try {
      const att = await prisma.examAttempt.findUnique({
        where: { id: attemptId },
        include: { student: true }
      })
      const targetExamId = examId || att?.examId
      if (!targetExamId) return

      const studentName = att?.student?.fullName || metadata?.studentName || 'Student'
      const institutionId = att?.student?.institutionId || metadata?.institutionId || '—'
      const violationCount = att?.violationCount || 0
      const status = att?.status || 'IN_PROGRESS'
      const isHeartbeat = eventType === 'HEARTBEAT_SNAPSHOT' || eventType === 'SCREEN_SAMPLE'

      if (!isHeartbeat) {
        socketEmitter.emitToInvigilators(targetExamId, 'proctoring:violation', {
          attemptId, studentName, institutionId, eventType, severity,
          snapshotDataUrl, violationCount, attemptStatus: status, createdAt: new Date().toISOString()
        })
      }

      socketEmitter.emitToInvigilators(targetExamId, 'attempt:updated', {
        attemptId, studentName, institutionId, attemptStatus: status,
        violationCount, latestScreenSnapshotUrl: snapshotDataUrl, lastActiveAt: new Date().toISOString()
      })
    } catch (_) {}
  }

  async flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    if (this.buffer.length === 0) return

    const batch = this.buffer.splice(0, this.maxBatch)
    const logsToInsert = batch.map(b => ({
      attemptId: b.attemptId, eventType: b.eventType, severity: b.severity,
      metadata: b.metadata, evidenceS3Key: b.evidenceS3Key
    }))

    try {
      const inserted = await proctoringSql.batchInsertLogs(logsToInsert)
      batch.forEach((b, idx) => b.resolve(inserted[idx] || { status: 'recorded' }))
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to flush proctoring batch to database')
      batch.forEach(b => b.reject(err))
    }

    if (this.buffer.length > 0) this.timer = setTimeout(() => this.flush(), this.flushIntervalMs)
  }

  async flushBuffer() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    while (this.buffer.length > 0) await this.flush()
  }

  async shutdownProctoringBuffer() { return this.flushBuffer() }
  async getAttemptLogs(attemptId) { return proctoringSql.getLogsByAttempt(attemptId) }
  async getExamLogs(examId) { return proctoringSql.getLogsByExam(examId) }

  async getLiveExamFeed(examId) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, courseCode: true, status: true, startTime: true, endTime: true }
    })
    if (!exam) {
      const err = new Error('Exam not found')
      err.status = 404
      throw err
    }

    const [assignments, attempts, rawViolations] = await Promise.all([
      prisma.examAssignment.findMany({ where: { examId, assignedRole: 'STUDENT' }, include: { user: true } }),
      prisma.examAttempt.findMany({ where: { examId }, include: { student: true } }),
      prisma.proctoringLog.findMany({
        where: { attempt: { examId }, eventType: { notIn: ['HEARTBEAT_SNAPSHOT', 'SCREEN_SAMPLE'] } },
        include: { attempt: { include: { student: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      })
    ])

    const candidateMap = new Map()
    for (const a of assignments) {
      if (a.user) candidateMap.set(a.user.id, { studentId: a.user.id, studentName: a.user.fullName || a.user.email, institutionId: a.user.institutionId || '—' })
    }
    for (const att of attempts) {
      if (att.student && !candidateMap.has(att.studentId)) {
        candidateMap.set(att.studentId, { studentId: att.studentId, studentName: att.student.fullName || att.student.email, institutionId: att.student.institutionId || '—' })
      }
    }

    const attemptMap = new Map(attempts.map(a => [a.studentId, a]))
    const attemptIds = attempts.map(a => a.id)
    const latestLogs = attemptIds.length ? await prisma.proctoringLog.findMany({
      where: { attemptId: { in: attemptIds } },
      orderBy: { createdAt: 'desc' },
      take: 150
    }) : []

    const snapMap = new Map()
    for (const l of latestLogs) {
      if (!snapMap.has(l.attemptId) && l.metadata?.snapshotDataUrl) {
        snapMap.set(l.attemptId, { url: l.metadata.snapshotDataUrl, at: l.createdAt })
      }
    }

    const candidates = Array.from(candidateMap.values()).map(c => {
      const att = attemptMap.get(c.studentId)
      const snap = att ? snapMap.get(att.id) : null
      return {
        ...c,
        attemptId: att?.id || null,
        attemptStatus: att?.status || 'NOT_STARTED',
        violationCount: att?.violationCount || 0,
        latestScreenSnapshotUrl: snap?.url || null,
        lastActiveAt: snap?.at || att?.startedAt || null
      }
    })

    const violations = rawViolations.map(v => ({
      id: String(v.id),
      attemptId: v.attemptId,
      studentName: v.attempt?.student?.fullName || 'Student',
      institutionId: v.attempt?.student?.institutionId || '—',
      eventType: v.eventType,
      severity: v.severity,
      snapshotDataUrl: v.metadata?.snapshotDataUrl || null,
      createdAt: v.createdAt
    }))

    return { status: 'success', exam, candidates, violations }
  }
}

const proctoringService = new ProctoringService()
const flushBuffer = () => proctoringService.flushBuffer()
const shutdownProctoringBuffer = () => proctoringService.shutdownProctoringBuffer()

module.exports = {
  proctoringService,
  ProctoringService,
  flushBuffer,
  shutdownProctoringBuffer
}
