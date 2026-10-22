const { prisma } = require('../../infra/postgres/client')

async function findAttemptByExamAndStudent(examId, studentId) {
  if (!examId || !studentId) return null
  return prisma.examAttempt.findUnique({
    where: {
      examId_studentId: { examId, studentId }
    }
  })
}

async function findAttemptById(id) {
  if (!id) return null
  return prisma.examAttempt.findUnique({
    where: { id }
  })
}

async function createOrGetReadinessAttempt(examId, studentId) {
  const existing = await prisma.examAttempt.findUnique({
    where: { examId_studentId: { examId, studentId } }
  })
  if (existing) return existing

  try {
    return await prisma.examAttempt.create({
      data: {
        examId,
        studentId,
        status: 'NOT_STARTED',
        faceVerified: false
      }
    })
  } catch (err) {
    return prisma.examAttempt.findUnique({
      where: { examId_studentId: { examId, studentId } }
    })
  }
}

async function startAttempt(attemptId, durationMinutes, examEndTime = null) {
  const dur = Math.max(1, Number(durationMinutes) || 60)
  const now = new Date()
  let expiresAt = new Date(now.getTime() + dur * 60 * 1000)
  if (examEndTime) {
    const end = new Date(examEndTime)
    if (!isNaN(end.getTime()) && end < expiresAt) {
      expiresAt = end
    }
  }

  return prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      status: 'IN_PROGRESS',
      startedAt: now,
      expiresAt
    }
  })
}

async function upsertAnswer(attemptId, questionId, selectedOptionIndex, isBookmarked) {
  const data = {}
  if (selectedOptionIndex !== undefined && selectedOptionIndex !== null) {
    if (Array.isArray(selectedOptionIndex)) {
      let mask = 0
      selectedOptionIndex.forEach(idx => {
        const n = Number(idx)
        if (!isNaN(n) && n >= 0 && n <= 10) mask |= (1 << n)
      })
      data.selectedOptionIndex = 100 + mask
    } else {
      data.selectedOptionIndex = Number(selectedOptionIndex)
    }
  }
  if (isBookmarked !== undefined) {
    data.isBookmarked = Boolean(isBookmarked)
  }

  try {
    return await prisma.attemptAnswer.upsert({
      where: {
        attemptId_questionId: { attemptId, questionId }
      },
      create: {
        attemptId,
        questionId,
        selectedOptionIndex: data.selectedOptionIndex !== undefined ? data.selectedOptionIndex : null,
        isBookmarked: Boolean(isBookmarked)
      },
      update: data
    })
  } catch (_) {
    return prisma.attemptAnswer.update({
      where: {
        attemptId_questionId: { attemptId, questionId }
      },
      data
    })
  }
}

async function getAttemptAnswers(attemptId) {
  return prisma.attemptAnswer.findMany({
    where: { attemptId }
  })
}

async function submitAndGradeAttempt(attemptId) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      exam: {
        include: { questions: true }
      }
    }
  })

  if (!attempt) return null

  // Calculate score based on Question correctOptionIndex and marks
  const questionsMap = new Map()
  attempt.exam?.questions?.forEach(q => questionsMap.set(q.id, q))

  let totalScore = 0
  for (const ans of attempt.answers || []) {
    const q = questionsMap.get(ans.questionId)
    if (!q) continue

    const opts = q.options
    const isMulti = opts && typeof opts === 'object' && !Array.isArray(opts) && opts.type === 'MULTI_SELECT'

    if (isMulti) {
      const correctIndices = Array.isArray(opts.correctIndices) ? opts.correctIndices : [q.correctOptionIndex]
      let selected = []
      if (ans.selectedOptionIndex !== null && ans.selectedOptionIndex !== undefined) {
        if (ans.selectedOptionIndex >= 100) {
          const mask = ans.selectedOptionIndex - 100
          for (let bit = 0; bit <= 10; bit++) {
            if ((mask & (1 << bit)) !== 0) selected.push(bit)
          }
        } else {
          selected = [ans.selectedOptionIndex]
        }
      }

      if (selected.length === 0) {
        // Unattempted: 0 marks
        continue
      }

      const hasWrong = selected.some(idx => !correctIndices.includes(idx))
      if (hasWrong) {
        totalScore -= Math.abs(Number(q.negativeMarks || 0))
      } else if (selected.length === correctIndices.length && selected.every(idx => correctIndices.includes(idx))) {
        totalScore += Number(q.marks || 1)
      } else {
        const partialPerOpt = Number(opts.partialMark || (Number(q.marks || 1) / correctIndices.length))
        totalScore += (selected.length * partialPerOpt)
      }
    } else {
      if (ans.selectedOptionIndex === q.correctOptionIndex) {
        totalScore += Number(q.marks || 1)
      } else if (ans.selectedOptionIndex !== null && ans.selectedOptionIndex !== undefined) {
        totalScore -= Math.abs(Number(q.negativeMarks || 0))
      }
    }
  }

  totalScore = Math.round(Math.max(0, totalScore) * 100) / 100

  return prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      score: totalScore
    }
  })
}

async function updateAttemptStatus(attemptId, status) {
  return prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      status: String(status).toUpperCase()
    }
  })
}

module.exports = {
  findAttemptByExamAndStudent,
  findAttemptById,
  createOrGetReadinessAttempt,
  startAttempt,
  upsertAnswer,
  getAttemptAnswers,
  submitAndGradeAttempt,
  updateAttemptStatus
}
