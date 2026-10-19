'use strict'

const { generateExamQuestions } = require('./ai.generator')
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
    const { pdfBase64, fileName, count, difficulty, topicHint } = req.body || {}
    const fileBuffer = req.file?.buffer
    const result = await examWizardService.generateFromPdf({
      pdfBase64,
      pdfBuffer: fileBuffer,
      fileName: fileName || req.file?.originalname,
      count: count || 10,
      difficulty: difficulty || 'MEDIUM',
      topicHint
    })
    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

async function publishWizard(req, res, next) {
  try {
    const { examWizardService } = require('./exam.wizard.service')
    const result = await examWizardService.publishWizard(req.user?.id, req.body)
    return res.status(201).json({ status: 'success', ...result })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  generateQuestions,
  generateInvigilator,
  listInvigilators,
  removeInvigilator,
  generateFromPdf,
  publishWizard
}
