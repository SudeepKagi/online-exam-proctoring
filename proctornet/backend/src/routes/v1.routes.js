const express = require('express')

const authController = require('../modules/auth/controller')
const examController = require('../modules/exams/controller')
const questionController = require('../modules/questions/controller')
const attemptController = require('../modules/attempts/controller')
const answerController = require('../modules/answers/controller')
const submissionController = require('../modules/submissions/controller')
const proctoringController = require('../modules/proctoring/controller')
const resultController = require('../modules/results/controller')
const mediaController = require('../modules/media/controller')
const auditController = require('../modules/audit/controller')

const router = express.Router()

router.use('/auth', authController)
router.use('/', examController)
router.use('/', questionController)
router.use('/', attemptController)
router.use('/', answerController)
router.use('/', submissionController)
router.use('/', proctoringController)
router.use('/', resultController)
router.use('/', mediaController)
router.use('/', auditController)

module.exports = router
