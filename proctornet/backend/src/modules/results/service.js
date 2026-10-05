const { resultRepository } = require('./repository')
const { prisma } = require('../../infra/postgres/client')
const { toStudentResultDTO, toFacultyResultDTO } = require('./dto')
const {
  NotFoundError,
  ForbiddenError
} = require('../../shared/errors')
const { ROLES, normalizeRole } = require('../../shared/roles')

class ResultService {
  /**
   * Get student exam result, enforcing exam release policy
   */
  async getResultForStudent(attemptId, studentId) {
    const result = await resultRepository.findByAttempt(attemptId)
    if (!result) {
      throw new NotFoundError(`Result for attempt '${attemptId}' is still being evaluated or not found`)
    }

    if (result.attempt?.studentId !== studentId) {
      throw new ForbiddenError('Access denied: You do not own this attempt')
    }

    return toStudentResultDTO(result, result.exam)
  }

  /**
   * Get result for staff (Faculty / Admin)
   */
  async getResultForStaff(attemptId, user) {
    const result = await resultRepository.findByAttempt(attemptId)
    if (!result) {
      throw new NotFoundError(`Result for attempt '${attemptId}' is still being evaluated or not found`)
    }

    const role = normalizeRole(user.role)
    if (role === ROLES.FACULTY && result.exam?.facultyId !== user.id) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    return toFacultyResultDTO(result)
  }

  /**
   * Get all results for an exam (Faculty / Admin view)
   */
  async getResultsForExam(examId, userId, userRole) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId }
    })

    if (!exam) {
      throw new NotFoundError(`Exam '${examId}' not found`)
    }

    const role = normalizeRole(userRole)
    if (role === ROLES.FACULTY && exam.facultyId !== userId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    // Do NOT recompute ranks per read (C-07: compute once after last result of an exam job)
    const results = await resultRepository.findByExam(examId)
    return results.map(toFacultyResultDTO)
  }

  /**
   * Release results to students (Faculty / Admin)
   */
  async releaseResults(examId, userId, userRole) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId }
    })

    if (!exam) {
      throw new NotFoundError(`Exam '${examId}' not found`)
    }

    const role = normalizeRole(userRole)
    if (role === ROLES.FACULTY && exam.facultyId !== userId) {
      throw new ForbiddenError('Access denied: You do not own this exam')
    }

    await prisma.$transaction([
      prisma.exam.update({
        where: { id: examId },
        data: { resultsReleased: true }
      }),
      prisma.examResult.updateMany({
        where: { examId },
        data: {
          isReleased: true,
          releasedAt: new Date()
        }
      })
    ])

    // Broadcast via Redis emitter (C-06: inv:{examId} only)
    try {
      const { socketEmitter } = require('../../infra/websocket/emitter')
      socketEmitter.emitToInvigilators(examId, 'exam:results_released', { examId })
    } catch {
      // Best-effort notification
    }

    return { success: true, examId, releasedAt: new Date().toISOString() }
  }
}

module.exports = {
  ResultService,
  resultService: new ResultService()
}
