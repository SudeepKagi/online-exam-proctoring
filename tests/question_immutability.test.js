const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const { questionService } = require(path.join(__dirname, '../proctornet/backend/src/modules/questions/service'))
const { questionRepository } = require(path.join(__dirname, '../proctornet/backend/src/modules/questions/repository'))
const facultyService = require(path.join(__dirname, '../proctornet/backend/src/modules/faculty/service'))
const facultyRepository = require(path.join(__dirname, '../proctornet/backend/src/modules/faculty/repository'))
const { ConflictError, ValidationError } = require(path.join(__dirname, '../proctornet/backend/src/shared/errors'))
const { ROLES } = require(path.join(__dirname, '../proctornet/backend/src/shared/roles'))

const TEST_EXAM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const TEST_QUESTION_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const TEST_FACULTY_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

describe('BUG-E06: Question Immutability After Publish & In-Place Option Updates', () => {
  it('blocks creating questions in published or non-draft exams with ConflictError', async () => {
    const origFindExam = questionRepository.findExamById
    try {
      questionRepository.findExamById = async () => ({
        id: TEST_EXAM_ID,
        facultyId: TEST_FACULTY_ID,
        status: 'PUBLISHED'
      })

      await assert.rejects(
        async () => {
          await questionService.createQuestion(TEST_EXAM_ID, {
            questionText: 'Test?',
            options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }]
          }, TEST_FACULTY_ID, ROLES.FACULTY)
        },
        (err) => {
          assert.ok(err instanceof ConflictError)
          assert.match(err.message, /Content is immutable once published/i)
          return true
        }
      )
    } finally {
      questionRepository.findExamById = origFindExam
    }
  })

  it('blocks deleting questions in non-draft exams with ConflictError', async () => {
    const origFind = questionRepository.findByIdWithExam
    try {
      questionRepository.findByIdWithExam = async () => ({
        id: TEST_QUESTION_ID,
        examId: TEST_EXAM_ID,
        exam: {
          id: TEST_EXAM_ID,
          facultyId: TEST_FACULTY_ID,
          status: 'LIVE'
        }
      })

      await assert.rejects(
        async () => {
          await questionService.deleteQuestion(TEST_QUESTION_ID, TEST_FACULTY_ID, ROLES.FACULTY)
        },
        (err) => {
          assert.ok(err instanceof ConflictError)
          assert.match(err.message, /Content is immutable once published/i)
          return true
        }
      )
    } finally {
      questionRepository.findByIdWithExam = origFind
    }
  })

  it('blocks updating or deleting questions through facultyService when exam is not DRAFT', async () => {
    const origFindQ = facultyRepository.findQuestionById
    const origFindE = facultyRepository.findExamById
    try {
      facultyRepository.findQuestionById = async () => ({
        id: TEST_QUESTION_ID,
        examId: TEST_EXAM_ID
      })
      facultyRepository.findExamById = async () => ({
        id: TEST_EXAM_ID,
        facultyId: TEST_FACULTY_ID,
        status: 'PUBLISHED'
      })

      await assert.rejects(
        async () => {
          await facultyService.updateQuestion(TEST_QUESTION_ID, {
            questionText: 'Updated Q',
            options: [{ text: '1', isCorrect: true }, { text: '2', isCorrect: false }]
          }, TEST_FACULTY_ID)
        },
        (err) => err instanceof ValidationError
      )

      await assert.rejects(
        async () => {
          await facultyService.deleteQuestion(TEST_QUESTION_ID, TEST_FACULTY_ID)
        },
        (err) => err instanceof ValidationError
      )
    } finally {
      facultyRepository.findQuestionById = origFindQ
      facultyRepository.findExamById = origFindE
    }
  })

  it('updates options in-place in facultyRepository without deleting existing option IDs', async () => {
    const { prisma } = require(path.join(__dirname, '../proctornet/backend/src/infra/postgres/client'))
    const origTransaction = prisma.$transaction

    try {
      const existingOptions = [
        { id: 'opt-id-1', questionId: TEST_QUESTION_ID, text: 'Old Opt A', isCorrect: true, order: 0 },
        { id: 'opt-id-2', questionId: TEST_QUESTION_ID, text: 'Old Opt B', isCorrect: false, order: 1 }
      ]

      const updatedCalls = []
      let deleteCalled = false

      prisma.$transaction = async (cb) => {
        const txMock = {
          question: {
            findUnique: async () => ({
              id: TEST_QUESTION_ID,
              options: existingOptions
            }),
            update: async ({ data }) => ({
              id: TEST_QUESTION_ID,
              questionText: data.questionText,
              options: [
                { id: 'opt-id-1', text: 'New Opt A', isCorrect: false, order: 0 },
                { id: 'opt-id-2', text: 'New Opt B', isCorrect: true, order: 1 }
              ]
            })
          },
          questionOption: {
            findMany: async () => existingOptions,
            update: async ({ where, data }) => {
              updatedCalls.push({ where, data })
              return { id: where.id, ...data }
            },
            deleteMany: async () => {
              deleteCalled = true
              return { count: 0 }
            },
            create: async () => {}
          }
        }
        return cb(txMock)
      }

      const result = await facultyRepository.updateQuestion(TEST_QUESTION_ID, {
        questionText: 'Revised Question',
        options: [
          { text: 'New Opt A', isCorrect: false, order: 0 },
          { text: 'New Opt B', isCorrect: true, order: 1 }
        ]
      })

      assert.equal(updatedCalls.length, 2, 'Should update exactly 2 existing options in-place')
      assert.equal(updatedCalls[0].where.id, 'opt-id-1', 'First option should maintain original id')
      assert.equal(updatedCalls[1].where.id, 'opt-id-2', 'Second option should maintain original id')
      assert.equal(deleteCalled, false, 'No options should be deleted when count is equal')
      assert.equal(result.id, TEST_QUESTION_ID)
    } finally {
      prisma.$transaction = origTransaction
    }
  })

  after(async () => {
    try {
      const { closeAll } = require('../proctornet/backend/src/lifecycle')
      await closeAll()
    } catch {}
  })
})
