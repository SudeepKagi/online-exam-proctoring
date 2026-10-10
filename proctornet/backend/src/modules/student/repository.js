const { prisma } = require('../../infra/postgres/client')
const { isStudentEligible } = require('../exams/eligibility')

class StudentRepository {
  async getStudentById(id) {
    return prisma.student.findUnique({
      where: { id },
      include: { department: true }
    })
  }

  async updateStudent(id, data) {
    return prisma.student.update({
      where: { id },
      data,
      include: { department: true }
    })
  }

  async listAvailableExamsForStudent(student) {
    const exams = await prisma.exam.findMany({
      where: {
        status: { in: ['PUBLISHED', 'LIVE', 'ENDED', 'EVALUATED'] }
      },
      include: {
        attempts: {
          where: { studentId: student.id }
        }
      },
      orderBy: { startTime: 'desc' }
    })
    return exams.filter(exam => isStudentEligible(exam, student))
  }

  async getExamById(examId) {
    return prisma.exam.findUnique({
      where: { id: examId },
      include: {
        faculty: { select: { id: true, name: true, email: true, departmentCode: true } }
      }
    })
  }

  async getAttemptByStudentAndExam(studentId, examId) {
    return prisma.examAttempt.findFirst({
      where: { studentId, examId },
      include: {
        attemptQuestions: {
          include: {
            question: {
              include: { options: { orderBy: { order: 'asc' } } }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        answers: true,
        examResult: true
      }
    })
  }

  async getAttemptById(attemptId) {
    return prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        attemptQuestions: {
          include: {
            question: {
              include: { options: { orderBy: { order: 'asc' } } }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        answers: true,
        examResult: true
      }
    })
  }

  async createAttempt({ examId, studentId, expiresAt, status = 'ACTIVE' }) {
    return prisma.examAttempt.create({
      data: {
        examId,
        studentId,
        expiresAt,
        status,
        startedAt: new Date()
      }
    })
  }

  async saveAttemptQuestion(attemptId, questionId, displayOrder) {
    return prisma.attemptQuestion.create({
      data: {
        attemptId,
        questionId,
        displayOrder
      }
    })
  }

  async upsertAnswer({ attemptId, questionId, selectedOption }) {
    return prisma.answer.upsert({
      where: {
        attemptId_questionId: { attemptId, questionId }
      },
      update: {
        selectedOption: selectedOption !== null && selectedOption !== undefined ? String(selectedOption) : null,
        submittedAt: new Date()
      },
      create: {
        attemptId,
        questionId,
        selectedOption: selectedOption !== null && selectedOption !== undefined ? String(selectedOption) : null,
        submittedAt: new Date()
      }
    })
  }

  async listResultsForStudent(studentId) {
    return prisma.examResult.findMany({
      where: {
        attempt: { studentId },
        isReleased: true
      },
      include: {
        exam: { select: { id: true, title: true, subject: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async recordVerificationAuditLog({ studentId, attemptId, checkType, score, status, details }) {
    return prisma.verificationAuditLog.create({
      data: {
        id: require('crypto').randomUUID(),
        studentId,
        attemptId: attemptId || null,
        checkType,
        score,
        status,
        details
      }
    })
  }

  async saveIdentityVerification({ attemptId, liveFaceMatchScore, idCardOcrUsn, idCardMatchResult, faceWithIdKey, status }) {
    return prisma.identityVerification.upsert({
      where: { attemptId },
      update: {
        liveFaceMatchScore,
        idCardOcrUsn,
        idCardMatchResult,
        faceWithIdKey,
        status,
        verifiedAt: new Date()
      },
      create: {
        attemptId,
        liveFaceMatchScore,
        idCardOcrUsn,
        idCardMatchResult,
        faceWithIdKey,
        status,
        verifiedAt: new Date()
      }
    })
  }

  async listChatMessages(examId, studentId, limit = 50) {
    return prisma.chatMessage.findMany({
      where: { examId, studentId },
      take: limit,
      orderBy: { timestamp: 'desc' }
    })
  }
}

module.exports = new StudentRepository()
