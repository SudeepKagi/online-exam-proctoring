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

module.exports = {
  generateQuestions,
  generateInvigilator,
  listInvigilators,
  removeInvigilator
}
