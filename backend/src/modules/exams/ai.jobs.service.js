'use strict'

const crypto = require('crypto')
const {
  generateExamQuestions,
  AI_MAX_QUESTIONS_PER_RUN,
  AI_MAX_PDF_PAGES,
  AI_DAILY_QUESTION_QUOTA_PER_USER
} = require('./ai.generator')

// In-memory Job Storage & Daily Quota Tracking
const jobs = new Map()
const userDailyQuotas = new Map() // creatorId -> { date: 'YYYY-MM-DD', count: N }

function getTodayString() {
  return new Date().toISOString().split('T')[0]
}

function checkAndIncrementQuota(creatorId, requestedCount) {
  if (!creatorId) return { allowed: true }

  const today = getTodayString()
  const current = userDailyQuotas.get(creatorId) || { date: today, count: 0 }

  if (current.date !== today) {
    current.date = today
    current.count = 0
  }

  if (current.count + requestedCount > AI_DAILY_QUESTION_QUOTA_PER_USER) {
    const remaining = Math.max(0, AI_DAILY_QUESTION_QUOTA_PER_USER - current.count)
    return {
      allowed: false,
      remaining,
      message: `Daily question quota exceeded. You have ${remaining} questions remaining today (limit: ${AI_DAILY_QUESTION_QUOTA_PER_USER}/day).`
    }
  }

  current.count += requestedCount
  userDailyQuotas.set(creatorId, current)
  return { allowed: true, currentCount: current.count }
}

class AiJobsService {
  async startGenerationJob({
    creatorId,
    extractedText,
    fileName,
    pageCount = 1,
    pages = [],
    settings = {}
  }) {
    const count = parseInt(settings.count, 10) || 10

    // 1. Check max questions per run limit
    if (count > AI_MAX_QUESTIONS_PER_RUN) {
      const err = new Error(`Requested questions (${count}) exceeds maximum allowed per run (${AI_MAX_QUESTIONS_PER_RUN}).`)
      err.status = 400
      err.code = 'LIMIT_EXCEEDED'
      throw err
    }

    // 2. Check PDF page limit
    if (pageCount > AI_MAX_PDF_PAGES) {
      const err = new Error(`Document page count (${pageCount}) exceeds maximum allowed limit (${AI_MAX_PDF_PAGES} pages).`)
      err.status = 400
      err.code = 'PAGE_LIMIT_EXCEEDED'
      throw err
    }

    // 3. Check Daily User Quota
    const quotaCheck = checkAndIncrementQuota(creatorId, count)
    if (!quotaCheck.allowed) {
      const err = new Error(quotaCheck.message)
      err.status = 429
      err.code = 'QUOTA_EXCEEDED'
      throw err
    }

    const jobId = crypto.randomUUID()
    const batchSize = 10
    const totalBatches = Math.ceil(count / batchSize)

    // Slice targets per batch
    const batches = []
    let remaining = count
    for (let i = 0; i < totalBatches; i++) {
      const thisBatch = Math.min(batchSize, remaining)
      batches.push({
        batchIndex: i,
        count: thisBatch,
        status: 'pending'
      })
      remaining -= thisBatch
    }

    const job = {
      id: jobId,
      creatorId,
      status: 'in_progress', // 'in_progress' | 'completed' | 'cancelled' | 'failed'
      progress: {
        completed: 0,
        total: count,
        currentBatchIndex: 0,
        totalBatches
      },
      settings,
      extractedText,
      fileName,
      pages,
      batches,
      questions: [],
      metadata: null,
      honestyNote: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    jobs.set(jobId, job)

    // Fire off async execution
    this.processJobBatches(jobId)

    return {
      jobId,
      status: 'in_progress',
      total: count,
      totalBatches
    }
  }

  async processJobBatches(jobId) {
    const job = jobs.get(jobId)
    if (!job) return

    for (let i = job.progress.currentBatchIndex; i < job.batches.length; i++) {
      // Re-fetch job to check for cancellation
      const currentJob = jobs.get(jobId)
      if (!currentJob || currentJob.status === 'cancelled') {
        return
      }

      const batch = currentJob.batches[i]
      currentJob.progress.currentBatchIndex = i
      batch.status = 'processing'

      try {
        const genResult = await generateExamQuestions({
          topic: currentJob.settings.topic || 'Engineering',
          syllabusText: currentJob.extractedText,
          pages: currentJob.pages || [],
          difficulty: currentJob.settings.difficulty || 'MEDIUM',
          difficultySplit: currentJob.settings.difficultySplit,
          count: batch.count,
          focus: currentJob.settings.focus || 'concept + application',
          optionsPerQuestion: currentJob.settings.optionsPerQuestion || 4,
          allowMultiple: currentJob.settings.allowMultiple || false,
          language: currentJob.settings.language || 'same as material',
          explanations: currentJob.settings.explanations !== false,
          avoidDuplicates: currentJob.settings.avoidDuplicates !== false,
          isExtractMode: Boolean(currentJob.settings.isExtractMode),
          existingQuestions: currentJob.questions
        })

        const newQuestions = genResult.questions || []
        currentJob.questions.push(...newQuestions)
        currentJob.progress.completed = currentJob.questions.length
        batch.status = 'completed'

        if (!currentJob.metadata) {
          currentJob.metadata = {
            title: genResult.title,
            courseCode: genResult.courseCode,
            subject: genResult.subject,
            description: genResult.description,
            suggestedDuration: genResult.suggestedDuration
          }
        }
        if (genResult.honestyNote) {
          currentJob.honestyNote = genResult.honestyNote
        }
        currentJob.aiAudit = genResult.aiAudit
        currentJob.updatedAt = new Date().toISOString()
      } catch (err) {
        batch.status = 'failed'
        currentJob.status = 'failed'
        currentJob.error = {
          batchIndex: i,
          message: err.message || 'Generation failed on batch ' + (i + 1)
        }
        currentJob.updatedAt = new Date().toISOString()
        return // Halt and preserve partial results
      }
    }

    const finalJob = jobs.get(jobId)
    if (finalJob && finalJob.status !== 'cancelled') {
      finalJob.status = 'completed'
      const questions = finalJob.questions || []
      const coveredPages = Array.from(new Set(questions.map(q => Number(q.sourcePage) || 1))).sort((a, b) => a - b)
      const totalPages = finalJob.pages?.length || 1
      const readablePages = (finalJob.pages || []).filter(p => p.isReadable).length || totalPages
      finalJob.sourceCoverage = {
        coveredPages,
        totalPages,
        readablePages,
        coveragePercent: Math.round((coveredPages.length / Math.max(1, readablePages)) * 100)
      }
      finalJob.updatedAt = new Date().toISOString()
    }
  }

  getJob(jobId, creatorId) {
    const job = jobs.get(jobId)
    if (!job) {
      const err = new Error('Generation job not found')
      err.status = 404
      err.code = 'NOT_FOUND'
      throw err
    }
    if (creatorId && job.creatorId !== creatorId) {
      const err = new Error('Access denied to generation job')
      err.status = 403
      err.code = 'FORBIDDEN'
      throw err
    }

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      questions: job.questions,
      metadata: job.metadata,
      honestyNote: job.honestyNote,
      aiAudit: job.aiAudit,
      error: job.error,
      canRetry: job.status === 'failed',
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }
  }

  cancelJob(jobId, creatorId) {
    const job = jobs.get(jobId)
    if (!job) {
      const err = new Error('Generation job not found')
      err.status = 404
      err.code = 'NOT_FOUND'
      throw err
    }
    if (creatorId && job.creatorId !== creatorId) {
      const err = new Error('Access denied to generation job')
      err.status = 403
      err.code = 'FORBIDDEN'
      throw err
    }

    job.status = 'cancelled'
    job.updatedAt = new Date().toISOString()

    return {
      id: job.id,
      status: 'cancelled',
      progress: job.progress,
      questions: job.questions, // partial results preserved
      message: 'Job cancelled. Partial results retained.'
    }
  }

  retryJob(jobId, creatorId) {
    const job = jobs.get(jobId)
    if (!job) {
      const err = new Error('Generation job not found')
      err.status = 404
      err.code = 'NOT_FOUND'
      throw err
    }
    if (creatorId && job.creatorId !== creatorId) {
      const err = new Error('Access denied to generation job')
      err.status = 403
      err.code = 'FORBIDDEN'
      throw err
    }

    job.status = 'in_progress'
    job.error = null
    this.processJobBatches(jobId)

    return {
      id: job.id,
      status: 'in_progress',
      progress: job.progress,
      message: 'Retrying generation job...'
    }
  }
}

const aiJobsService = new AiJobsService()

module.exports = {
  aiJobsService,
  AiJobsService,
  AI_MAX_QUESTIONS_PER_RUN,
  AI_MAX_PDF_PAGES,
  AI_DAILY_QUESTION_QUOTA_PER_USER
}
