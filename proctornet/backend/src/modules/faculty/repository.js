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
    const results = await prisma.examResult.findMany({
      where: { exam: { facultyId } },
      include: {
        exam: { select: { id: true, title: true, subject: true, totalMarks: true } },
        attempt: {
          select: {
            flagCount: true,
            status: true,
            submittedAt: true,
            student: { select: { id: true, name: true, usn: true, departmentCode: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return results.map(r => ({
      ...r,
      student: r.attempt?.student || null
    }))
  }

  async listExamResults(examId) {
    const results = await prisma.examResult.findMany({
      where: { examId },
      include: {
        exam: { select: { id: true, title: true, subject: true, totalMarks: true } },
        attempt: {
          select: {
            flagCount: true,
            status: true,
            submittedAt: true,
            student: { select: { id: true, name: true, usn: true, departmentCode: true } }
          }
        }
      },
      orderBy: { percentage: 'desc' }
    })
    return results.map(r => ({
      ...r,
      student: r.attempt?.student || null
    }))
  }

  async getStudentResult(resultId) {
    const res = await prisma.examResult.findUnique({
      where: { id: resultId },
      include: {
        exam: { select: { id: true, title: true, subject: true, totalMarks: true, facultyId: true } },
        attempt: {
          include: {
            student: { select: { id: true, name: true, usn: true, departmentCode: true } },
            answers: true
          }
        }
      }
    })
    if (!res) return null
    return {
      ...res,
      student: res.attempt?.student || null
    }
  }

  async getStudentResultByExam(examId, studentId) {
    const res = await prisma.examResult.findFirst({
      where: {
        examId,
        attempt: { studentId }
      },
      include: {
        exam: { select: { id: true, title: true, subject: true, totalMarks: true, facultyId: true } },
        attempt: {
          include: {
            student: { select: { id: true, name: true, usn: true, departmentCode: true } },
            answers: true
          }
        }
      }
    })
    if (!res) return null
    return {
      ...res,
      student: res.attempt?.student || null
    }
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
    const crypto = require('crypto')
    return prisma.question.create({
      data: {
        id: qData.id || crypto.randomUUID(),
        ...qData,
        options: options && options.length > 0 ? {
          create: options.map((opt, idx) => ({
            id: opt.id || crypto.randomUUID(),
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

  async findQuestionById(id) {
    return prisma.question.findUnique({
      where: { id },
      include: { options: { orderBy: { order: 'asc' } } }
    })
  }

  async updateQuestion(id, data) {
    const { options, ...qData } = data
    const crypto = require('crypto')
    return prisma.$transaction(async (tx) => {
      if (options && Array.isArray(options)) {
        const existingOptions = await tx.questionOption.findMany({
          where: { questionId: id },
          orderBy: { order: 'asc' }
        })

        // In-place updates for existing options (R-12)
        const updateCount = Math.min(existingOptions.length, options.length)
        for (let i = 0; i < updateCount; i++) {
          await tx.questionOption.update({
            where: { id: existingOptions[i].id },
            data: {
              text: options[i].text,
              isCorrect: Boolean(options[i].isCorrect),
              order: options[i].order !== undefined ? options[i].order : i
            }
          })
        }

        // Create new if options expanded
        if (options.length > existingOptions.length) {
          for (let i = updateCount; i < options.length; i++) {
            await tx.questionOption.create({
              data: {
                id: crypto.randomUUID(),
                questionId: id,
                text: options[i].text,
                isCorrect: Boolean(options[i].isCorrect),
                order: options[i].order !== undefined ? options[i].order : i
              }
            })
          }
        }

        // Delete excess if options shrunk
        if (existingOptions.length > options.length) {
          const excessIds = existingOptions.slice(updateCount).map(o => o.id)
          await tx.questionOption.deleteMany({
            where: { id: { in: excessIds } }
          })
        }
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

  async findFacultyById(id) {
    if (!id) return null
    return prisma.faculty.findUnique({
      where: { id }
    })
  }

  async findStudentById(id) {
    if (!id) return null
    return prisma.student.findUnique({
      where: { id }
    })
  }
}

module.exports = new FacultyRepository()
