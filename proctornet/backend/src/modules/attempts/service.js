const { attemptRepository } = require('./repository')
const { attemptStateMachine } = require('./stateMachine')
const { redisClient } = require('../../infra/redis/client')
const { prisma } = require('../../infra/postgres/client')
const { toStudentAttemptDTO } = require('./dto')
const {
  NotFoundError,
  ForbiddenError
} = require('../../shared/errors')
const { getPresignedReadUrl } = require('../../infra/s3/s3.client')
const { logger } = require('../../shared/logging')

class AttemptService {
  async attachPresignedImageUrls(questions) {
    return Promise.all((questions || []).map(async (q) => {
      if (!q.imageKey) return { ...q, imageUrl: null }
      try {
        const imageUrl = await getPresignedReadUrl(q.imageKey, 3600)
        return { ...q, imageUrl }
      } catch {
        return { ...q, imageUrl: null }
      }
    }))
  }
  /**
   * Start or resume an exam attempt (Kills B-01)
   * 1 round-trip fast path for pre-warmed READY attempts.
   */
  async startOrResumeAttempt(examId, studentId) {
    // 0. Promote any unattached healthy PRECHECK session to student's attempt before activation
    const existingAttempt = await attemptRepository.findByExamAndStudent(examId, studentId)
    if (existingAttempt) {
      await prisma.agentSession.updateMany({
        where: {
          studentId,
          scope: 'PRECHECK',
          state: 'HEALTHY',
          attemptId: null
        },
        data: {
          attemptId: existingAttempt.id,
          scope: 'ATTEMPT'
        }
      }).catch(() => {})
    }

    // 1. Fast-path: Update READY -> ACTIVE in single SQL statement
    let attempt = await attemptRepository.activateReadyAttempt(examId, studentId)

    if (!attempt) {
      // 2. Read existing attempt if already created
      attempt = await attemptRepository.findByExamAndStudent(examId, studentId)

      if (!attempt) {
        // 3. Late joiner fallback: check eligibility and create on-demand
        const eligible = await attemptRepository.checkStudentEligibility(examId, studentId)
        if (!eligible) {
          throw new ForbiddenError('You are not eligible to take this exam or the exam is not currently active')
        }

        const exam = await prisma.exam.findUnique({
          where: { id: examId },
          include: {
            questions: {
              include: { options: true }
            }
          }
        })

        if (!exam) {
          throw new NotFoundError(`Exam '${examId}' not found`)
        }

        const now = new Date()
        if (now < exam.startTime) {
          throw new ForbiddenError(`Exam has not started yet. Starts at ${exam.startTime.toISOString()}`)
        }
        if (now > exam.endTime) {
          throw new ForbiddenError(`Exam has already ended at ${exam.endTime.toISOString()}`)
        }
        if (['DRAFT', 'ENDED', 'EVALUATED', 'RESULT_PUBLISHED'].includes(exam.status)) {
          throw new ForbiddenError(`Exam is not open for attempts (status: ${exam.status})`)
        }

        attempt = await attemptRepository.createOnDemandAttempt(
          examId,
          studentId,
          exam,
          exam.questions
        )
      }
    }

    // 4. Handle terminal / non-active attempt statuses (E-03: Suspended/READY/expired resume must not receive question content)
    if (attempt.status === 'READY' && attempt.exam.deviceAgentPolicy === 'REQUIRED') {
      throw new ForbiddenError('Device companion check required: An active healthy agent session with no blocking findings (or a staff waiver) is required to start this exam.')
    }

    const isExpired = Boolean(attempt.expiresAt && new Date() > new Date(attempt.expiresAt))
    if (attemptStateMachine.isTerminal(attempt.status) || attempt.status === 'SUSPENDED' || attempt.status === 'READY' || isExpired) {
      if (isExpired && attempt.status === 'ACTIVE') {
        attempt.status = 'EXPIRED'
        await prisma.examAttempt.update({
          where: { id: attempt.id },
          data: { status: 'EXPIRED' }
        }).catch((err) => {
          logger.warn({ error: err.message, attemptId: attempt.id }, 'Failed to mark expired status')
        })
      }
      return {
        isTerminal: attemptStateMachine.isTerminal(attempt.status) || isExpired,
        attempt: toStudentAttemptDTO(attempt, [])
      }
    }

    // 5. Fetch immutable exam content via cache-aside
    const examQuestions = await this.getExamContentCached(examId)

    // 6. Fetch student-specific attempt questions and stored answers
    const studentQuestions = await attemptRepository.getAttemptQuestionsWithAnswers(attempt.id)

    // 7. Assemble questions applying student-specific display order and option shuffle
    const questionMap = new Map(examQuestions.map(q => [q.id, q]))
    const assembledQuestions = studentQuestions.map(sq => {
      const q = questionMap.get(sq.questionId)
      if (!q) return null

      let options = [...q.options]
      if (sq.optionOrder && sq.optionOrder.length === options.length) {
        // Map stored option index permutation
        const ordered = []
        for (const idx of sq.optionOrder) {
          if (options[idx]) ordered.push(options[idx])
        }
        if (ordered.length === options.length) {
          options = ordered
        }
      }

      return {
        attemptQuestionId: sq.attemptQuestionId,
        questionId: sq.questionId,
        displayOrder: sq.displayOrder,
        questionText: q.questionText,
        imageKey: q.imageKey,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        selectedOptionId: sq.selectedOptionId,
        revision: sq.revision,
        options
      }
    }).filter(Boolean)

    // Attach exam metadata if not loaded
    if (!attempt.exam) {
      attempt.exam = await this.getExamMetadataCached(examId)
    }

    const presignedQuestions = await this.attachPresignedImageUrls(assembledQuestions)

    return {
      isTerminal: false,
      attempt: toStudentAttemptDTO(attempt, presignedQuestions)
    }
  }

  /**
   * Cache-aside exam metadata in Redis with singleflight coalescing and L1 in-memory LRU
   */
  async getExamMetadataCached(examId) {
    const cacheKey = `pn:v1:exam:${examId}:meta`
    return redisClient.singleflight(cacheKey, async () => {
      const cached = await redisClient.getWithL1(cacheKey)
      if (cached) return cached

      const exam = await prisma.exam.findUnique({ where: { id: examId } })
      if (exam) {
        await redisClient.setWithL1(cacheKey, exam, 21600)
      }
      return exam
    })
  }

  /**
   * Cache-aside exam content in Redis with singleflight coalescing and L1 in-memory LRU
   */
  async getExamContentCached(examId) {
    const cacheKey = `pn:v1:exam:${examId}:content`

    // Singleflight coalesce concurrent requests for the same exam
    return redisClient.singleflight(cacheKey, async () => {
      // 1. Check L1 in-memory cache and Redis L2 cache
      const cached = await redisClient.getWithL1(cacheKey)
      if (cached) {
        return cached
      }

      // 2. Cache miss: Read from PostgreSQL
      const questions = await attemptRepository.getExamQuestionsForCache(examId)

      // 3. Populate Redis (TTL: 6 hours ± 10% jitter = ~21600 ± 2160 s)
      const jitter = Math.floor(Math.random() * 4320) - 2160
      const ttl = 21600 + jitter
      await redisClient.setWithL1(cacheKey, questions, ttl)

      return questions
    })
  }

  /**
   * Invalidate exam content cache when exam questions are edited in DRAFT status
   */
  async invalidateExamContentCache(examId) {
    const cacheKey = `pn:v1:exam:${examId}:content`
    await redisClient.del(cacheKey)
  }

  /**
   * Retrieve attempt for student session
   */
  async getAttemptForStudent(attemptId, studentId) {
    const attempt = await attemptRepository.findById(attemptId)
    if (!attempt) {
      throw new NotFoundError(`Attempt '${attemptId}' not found`)
    }

    // BOLA check: student must own this attempt
    if (attempt.studentId !== studentId) {
      throw new ForbiddenError('Access denied: You do not own this attempt')
    }

    const isExpired = Boolean(attempt.expiresAt && new Date() > new Date(attempt.expiresAt))
    if (attemptStateMachine.isTerminal(attempt.status) || attempt.status === 'SUSPENDED' || attempt.status === 'READY' || isExpired) {
      return toStudentAttemptDTO(attempt, [])
    }

    const examQuestions = await this.getExamContentCached(attempt.examId)
    const studentQuestions = await attemptRepository.getAttemptQuestionsWithAnswers(attempt.id)

    const questionMap = new Map(examQuestions.map(q => [q.id, q]))
    const assembledQuestions = studentQuestions.map(sq => {
      const q = questionMap.get(sq.questionId)
      if (!q) return null

      let options = [...q.options]
      if (sq.optionOrder && sq.optionOrder.length === options.length) {
        const ordered = []
        for (const idx of sq.optionOrder) {
          if (options[idx]) ordered.push(options[idx])
        }
        if (ordered.length === options.length) {
          options = ordered
        }
      }

      return {
        attemptQuestionId: sq.attemptQuestionId,
        questionId: sq.questionId,
        displayOrder: sq.displayOrder,
        questionText: q.questionText,
        imageKey: q.imageKey,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        selectedOptionId: sq.selectedOptionId,
        revision: sq.revision,
        options
      }
    }).filter(Boolean)

    const presignedQuestions = await this.attachPresignedImageUrls(assembledQuestions)
    return toStudentAttemptDTO(attempt, presignedQuestions)
  }

  /**
   * Idempotent pre-check readiness (creates READY attempt, never starts the clock)
   */
  async getOrCreateReadinessAttempt(examId, studentId) {
    let attempt = await attemptRepository.findByExamAndStudent(examId, studentId)
    if (!attempt) {
      const eligible = await attemptRepository.checkStudentEligibility(examId, studentId)
      if (!eligible) {
        throw new ForbiddenError('You are not eligible to take this exam or the exam is not currently active')
      }

      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
          questions: {
            include: { options: true }
          }
        }
      })

      if (!exam) {
        throw new NotFoundError(`Exam '${examId}' not found`)
      }

      if (['DRAFT', 'ENDED', 'EVALUATED', 'RESULT_PUBLISHED'].includes(exam.status)) {
        throw new ForbiddenError(`Exam is not open for pre-check (status: ${exam.status})`)
      }

      if (new Date() > exam.endTime) {
        throw new ForbiddenError(`Exam has already ended at ${exam.endTime.toISOString()}`)
      }

      const precheckMinutes = parseInt(process.env.PRECHECK_OPEN_MINUTES || '30', 10)
      const precheckOpenTime = new Date(exam.startTime.getTime() - precheckMinutes * 60 * 1000)
      if (new Date() < precheckOpenTime) {
        throw new ForbiddenError(`Pre-check opens ${precheckMinutes} minutes before exam start (${exam.startTime.toISOString()})`)
      }

      attempt = await attemptRepository.createReadyAttempt(
        examId,
        studentId,
        exam,
        exam.questions
      )
    }

    // Promote any unattached healthy PRECHECK session to this attempt
    try {
      await prisma.agentSession.updateMany({
        where: {
          studentId,
          scope: 'PRECHECK',
          state: 'HEALTHY',
          attemptId: null
        },
        data: {
          attemptId: attempt.id,
          scope: 'ATTEMPT'
        }
      })
    } catch (err) {
      logger.warn({ studentId, error: err.message }, 'Failed to promote PRECHECK companion session')
    }

    return {
      attempt: toStudentAttemptDTO(attempt, [])
    }
  }

  /**
   * Transition attempt state (Invigilator / Faculty / System)
   */
  async transitionState(attemptId, toStatus, options = {}) {
    return attemptStateMachine.transition(attemptId, toStatus, options)
  }
}

module.exports = {
  AttemptService,
  attemptService: new AttemptService()
}
