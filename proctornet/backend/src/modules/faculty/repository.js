const { prisma } = require('../../infra/postgres/client')

class FacultyRepository {
  async getDashboardStats(facultyId) {
    const [totalExams, activeExams, totalQuestions, totalResults] = await Promise.all([
      prisma.exam.count({ where: { facultyId } }),
      prisma.exam.count({ where: { facultyId, status: 'LIVE' } }),
      prisma.question.count({ where: { exam: { facultyId } } }),
      prisma.examResult.count({ where: { exam: { facultyId } } })
    ])

    const recentExams = await prisma.exam.findMany({
      where: { facultyId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true, attempts: true } }
      }
    })

    return {
      totalExams,
      activeExams,
      totalQuestions,
      totalResults,
      recentExams
    }
  }

  async listExams(facultyId) {
    return prisma.exam.findMany({
      where: { facultyId },
      include: {
        _count: { select: { questions: true, attempts: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async findExamById(id, facultyId = null) {
    if (!id) return null
    const where = { id }
    if (facultyId) where.facultyId = facultyId
    return prisma.exam.findFirst({
      where,
      include: {
        questions: {
          include: { options: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' }
        },
        _count: { select: { attempts: true } }
      }
    })
  }

  async deleteExam(id, facultyId) {
    return prisma.exam.delete({
      where: { id, facultyId }
    })
  }

  async listResultsForFaculty(facultyId) {
    return prisma.examResult.findMany({
      where: { exam: { facultyId } },
      include: {
        student: { select: { id: true, name: true, usn: true, departmentCode: true } },
        exam: { select: { id: true, title: true, subject: true, totalMarks: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async listExamResults(examId) {
    return prisma.examResult.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, name: true, usn: true, departmentCode: true } },
        exam: { select: { id: true, title: true, subject: true, totalMarks: true } },
        attempt: { select: { flagCount: true, status: true, submittedAt: true } }
      },
      orderBy: { percentage: 'desc' }
    })
  }

  async getStudentResult(resultId) {
    return prisma.examResult.findUnique({
      where: { id: resultId },
      include: {
        student: { select: { id: true, name: true, usn: true, departmentCode: true } },
        exam: { select: { id: true, title: true, subject: true, totalMarks: true, facultyId: true } },
        attempt: {
          include: {
            answers: true
          }
        }
      }
    })
  }

  async getStudentResultByExam(examId, studentId) {
    return prisma.examResult.findFirst({
      where: { examId, studentId },
      include: {
        student: { select: { id: true, name: true, usn: true, departmentCode: true } },
        exam: { select: { id: true, title: true, subject: true, totalMarks: true, facultyId: true } },
        attempt: {
          include: {
            answers: true
          }
        }
      }
    })
  }

  async listExamQuestions(examId) {
    return prisma.question.findMany({
      where: { examId },
      include: {
        options: { orderBy: { order: 'asc' } }
      },
      orderBy: { order: 'asc' }
    })
  }

  async createQuestion(data) {
    const { options, ...qData } = data
    return prisma.question.create({
      data: {
        ...qData,
        options: options && options.length > 0 ? {
          create: options.map((opt, idx) => ({
            text: opt.text,
            isCorrect: Boolean(opt.isCorrect),
            order: opt.order !== undefined ? opt.order : idx
          }))
        } : undefined
      },
      include: {
        options: { orderBy: { order: 'asc' } }
      }
    })
  }

  async updateQuestion(id, data) {
    const { options, ...qData } = data
    return prisma.$transaction(async (tx) => {
      if (options) {
        await tx.questionOption.deleteMany({ where: { questionId: id } })
        await tx.questionOption.createMany({
          data: options.map((opt, idx) => ({
            questionId: id,
            text: opt.text,
            isCorrect: Boolean(opt.isCorrect),
            order: opt.order !== undefined ? opt.order : idx
          }))
        })
      }
      return tx.question.update({
        where: { id },
        data: qData,
        include: { options: { orderBy: { order: 'asc' } } }
      })
    })
  }

  async deleteQuestion(id) {
    return prisma.question.delete({
      where: { id }
    })
  }

  async listEligibleStudents(departmentCode) {
    const where = {}
    if (departmentCode) where.departmentCode = departmentCode
    return prisma.student.findMany({
      where,
      select: {
        id: true,
        name: true,
        usn: true,
        email: true,
        departmentCode: true,
        semester: true,
        approvalStatus: true
      },
      orderBy: { usn: 'asc' }
    })
  }

  async approveStudent(studentId, facultyId) {
    return prisma.student.update({
      where: { id: studentId },
      data: {
        approvalStatus: 'APPROVED',
        approvedBy: facultyId,
        approvedAt: new Date()
      }
    })
  }

  async listExamAttemptsStudents(examId) {
    return prisma.examAttempt.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, name: true, usn: true, departmentCode: true, semester: true } }
      },
      orderBy: { createdAt: 'asc' }
    })
  }
}

module.exports = new FacultyRepository()
