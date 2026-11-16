'use strict'

const { generateExamQuestions, estimateSupportedQuestions } = require('./ai.generator')
const { aiJobsService } = require('./ai.jobs.service')
const { invigilatorService } = require('./invigilator.service')

async function generateQuestions(req, res, next) {
  try {
    const { topic, syllabusText, difficulty, count } = req.body || {}
    if (!topic) {
      return res.status(400).json({ error: { message: 'Topic is required for question generation' } })
    }
    const result = await generateExamQuestions({
      topic,
      syllabusText,
      difficulty: difficulty || 'MEDIUM',
      count: count || 5
    })
    return res.status(200).json({
      status: 'success',
      source: result.source,
      count: result.questions.length,
      questions: result.questions
    })
  } catch (err) {
    next(err)
  }
}

async function estimateAiCapacity(req, res, next) {
  try {
    const { text } = req.body || {}
    const estimation = estimateSupportedQuestions(text || '')
    return res.status(200).json({
      status: 'success',
      ...estimation
    })
  } catch (err) {
    next(err)
  }
}

async function startAiJob(req, res, next) {
  try {
    const { examWizardService } = require('./exam.wizard.service')
    const { pdfBase64, fileName, settings = {} } = req.body || {}
    const fileBuffer = req.file?.buffer

    // Extract text from PDF buffer or base64
    const extracted = await examWizardService.extractPdfText({
      pdfBase64,
      pdfBuffer: fileBuffer
    })

    const job = await aiJobsService.startGenerationJob({
      creatorId: req.user?.id,
      extractedText: extracted.text,
      pageCount: extracted.pageCount || 1,
      fileName: fileName || req.file?.originalname || 'StudyMaterial.pdf',
      settings
    })

    return res.status(202).json({
      status: 'accepted',
      ...job
    })
  } catch (err) {
    next(err)
  }
}

async function getAiJob(req, res, next) {
  try {
    const job = aiJobsService.getJob(req.params.jobId, req.user?.id)
    return res.status(200).json({ status: 'success', job })
  } catch (err) {
    next(err)
  }
}

async function cancelAiJob(req, res, next) {
  try {
    const result = aiJobsService.cancelJob(req.params.jobId, req.user?.id)
    return res.status(200).json({ status: 'success', ...result })
  } catch (err) {
    next(err)
  }
}

async function retryAiJob(req, res, next) {
  try {
    const result = aiJobsService.retryJob(req.params.jobId, req.user?.id)
    return res.status(200).json({ status: 'success', ...result })
  } catch (err) {
    next(err)
  }
}

async function generateInvigilator(req, res, next) {
  try {
    const invigilator = await invigilatorService.generateInvigilatorForExam(req.params.id, req.body)
    return res.status(201).json({ status: 'success', invigilator })
  } catch (err) {
    next(err)
  }
}

async function listInvigilators(req, res, next) {
  try {
    const invigilators = await invigilatorService.listExamInvigilators(req.params.id)
    return res.status(200).json({ status: 'success', invigilators })
  } catch (err) {
    next(err)
  }
}

async function removeInvigilator(req, res, next) {
  try {
    await invigilatorService.removeInvigilatorFromExam(req.params.id, req.params.userId)
    return res.status(200).json({ status: 'success', message: 'Invigilator unassigned' })
  } catch (err) {
    next(err)
  }
}

async function generateFromPdf(req, res, next) {
  try {
    const { examWizardService } = require('./exam.wizard.service')
    const {
      pdfBase64,
      fileName,
      count,
      difficulty,
      difficultySplit,
      focus,
      optionsPerQuestion,
      allowMultiple,
      language,
      explanations,
      avoidDuplicates,
      isExtractMode,
      topicHint
    } = req.body || {}
    const fileBuffer = req.file?.buffer
    const result = await examWizardService.generateFromPdf({
      pdfBase64,
      pdfBuffer: fileBuffer,
      fileName: fileName || req.file?.originalname,
      count: count || 10,
      difficulty: difficulty || 'MEDIUM',
      difficultySplit,
      focus,
      optionsPerQuestion,
      allowMultiple,
      language,
      explanations,
      avoidDuplicates,
      isExtractMode,
      topicHint,
      creatorId: req.user?.id
    })
    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

async function publishWizard(req, res, next) {
  try {
    const { examWizardService } = require('./exam.wizard.service')
    const result = await examWizardService.publishWizard(req.user?.id, req.body, req.user?.role)
    return res.status(201).json({ status: 'success', ...result })
  } catch (err) {
    next(err)
  }
}

async function getDraft(req, res, next) {
  try {
    const { examDraftService } = require('./exam.draft.service')
    const draft = await examDraftService.getDraft(req.user?.id)
    return res.status(200).json({ status: 'success', draft })
  } catch (err) {
    next(err)
  }
}

async function saveDraft(req, res, next) {
  try {
    const { examDraftService } = require('./exam.draft.service')
    const draft = await examDraftService.saveDraft(req.user?.id, req.body)
    return res.status(200).json({ status: 'success', draft })
  } catch (err) {
    next(err)
  }
}

async function deleteDraft(req, res, next) {
  try {
    const { examDraftService } = require('./exam.draft.service')
    await examDraftService.deleteDraft(req.user?.id)
    return res.status(200).json({ status: 'success', deleted: true })
  } catch (err) {
    next(err)
  }
}

async function getInstitutionSebStatus(req, res, next) {
  try {
    const { getInstitutionSebState } = require('../seb/seb.service')
    const state = await getInstitutionSebState({ bypassCache: req.query?.refresh === 'true' })
    return res.status(200).json({
      configured: state.configured,
      keyPresent: state.keyPresent,
      filePresent: state.filePresent,
      lastVerifiedAt: state.lastVerifiedAt,
      requestedMode: state.requestedMode,
      effectiveMode: state.effectiveMode,
      enforcementReason: state.enforcementReason,
      publicOrigin: state.publicOrigin
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  generateQuestions,
  estimateAiCapacity,
  startAiJob,
  getAiJob,
  cancelAiJob,
  retryAiJob,
  generateInvigilator,
  listInvigilators,
  removeInvigilator,
  generateFromPdf,
  publishWizard,
  getDraft,
  saveDraft,
  deleteDraft,
  getInstitutionSebStatus
}
