const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { validateMcqQuestion, normalizeExcelQuestionRow } = require('../src/validators/question.validator')
const { prisma } = require('../src/infra/postgres/client')

const questionService = require('../src/services/questionService')
const examService = require('../src/services/examService')
const studentService = require('../src/services/studentService')

let testFaculty = null

async function getOrCreateTestFaculty() {
  if (testFaculty) return testFaculty
  testFaculty = await prisma.faculty.upsert({
    where: { email: 'mcq.test.faculty@test.local' },
    update: {},
    create: {
      name: 'MCQ Test Faculty',
      email: 'mcq.test.faculty@test.local',
      password: 'hashed-password-faculty',
      employeeId: 'FAC_MCQ_001',
      departmentCode: 'CSE',
      isApproved: true
    }
  })
  return testFaculty
}

async function createTestExam(overrides = {}) {
  const fac = await getOrCreateTestFaculty()
  const now = new Date()
  const earlier = new Date(now.getTime() - 60000)
  const later = new Date(now.getTime() + 3600000)
  const uniqueInv = 'INV_' + Math.random().toString(36).substring(2, 9)

  return prisma.exam.create({
    data: {
      title: 'MCQ Test Exam',
      subject: 'CS101',
      duration: 60,
      status: 'DRAFT',
      facultyId: fac.id,
      startTime: earlier,
      endTime: later,
      invId: uniqueInv,
      invPasswordHash: 'sample-hash',
      allowedDepartments: ['CSE'],
      allowedSemesters: [6],
      ...overrides
    }
  })
}

describe('P2 MCQ-Only — Question Validation Matrix', () => {
  const baseValid = {
    questionText: 'Which data structure follows LIFO?',
    marks: 4,
    negativeMarks: 1,
    difficulty: 'MEDIUM',
    options: [
      { optionLetter: 'A', optionText: 'Queue', isCorrect: false },
      { optionLetter: 'B', optionText: 'Stack', isCorrect: true },
      { optionLetter: 'C', optionText: 'Tree', isCorrect: false },
      { optionLetter: 'D', optionText: 'Graph', isCorrect: false }
    ]
  }

  it('accepts valid 2-to-6 option MCQ with exactly one correct option', () => {
    const validated = validateMcqQuestion(baseValid)
    assert.strictEqual(validated.options.length, 4)
    assert.strictEqual(validated.marks, 4)
    assert.strictEqual(validated.negativeMarks, 1)
    const correctOpts = validated.options.filter(o => o.isCorrect)
    assert.strictEqual(correctOpts.length, 1)
    assert.strictEqual(correctOpts[0].text, 'Stack')
  })

  it('rejects 0 options', () => {
    assert.throws(
      () => validateMcqQuestion({ ...baseValid, options: [] }),
      /between 2 and 6 options/i
    )
  })

  it('rejects 1 option', () => {
    assert.throws(
      () => validateMcqQuestion({
        ...baseValid,
        options: [{ optionLetter: 'A', optionText: 'Only One', isCorrect: true }]
      }),
      /between 2 and 6 options/i
    )
  })

  it('rejects 7 options', () => {
    const sevenOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((letter, idx) => ({
      optionLetter: letter,
      optionText: `Option ${letter}`,
      isCorrect: idx === 0
    }))
    assert.throws(
      () => validateMcqQuestion({ ...baseValid, options: sevenOptions }),
      /between 2 and 6 options/i
    )
  })

  it('rejects 0 correct options', () => {
    const zeroCorrect = baseValid.options.map(o => ({ ...o, isCorrect: false }))
    assert.throws(
      () => validateMcqQuestion({ ...baseValid, options: zeroCorrect }),
      /exactly one correct option/i
    )
  })

  it('rejects 2 correct options', () => {
    const twoCorrect = baseValid.options.map((o, idx) => ({
      ...o,
      isCorrect: idx === 0 || idx === 1
    }))
    assert.throws(
      () => validateMcqQuestion({ ...baseValid, options: twoCorrect }),
      /exactly one correct option/i
    )
  })

  it('rejects negative_marks > marks', () => {
    assert.throws(
      () => validateMcqQuestion({ ...baseValid, marks: 2, negativeMarks: 3 }),
      /cannot exceed.*marks/i
    )
  })

  it('rejects negative_marks < 0', () => {
    assert.throws(
      () => validateMcqQuestion({ ...baseValid, marks: 2, negativeMarks: -1 }),
      /non-negative/i
    )
  })

  it('rejects empty question text', () => {
    assert.throws(
      () => validateMcqQuestion({ ...baseValid, questionText: '   ' }),
      /Question text is required/i
    )
  })

  it('rejects question text exceeding 5000 chars', () => {
    assert.throws(
      () => validateMcqQuestion({ ...baseValid, questionText: 'x'.repeat(5001) }),
      /exceeds maximum length of 5000/i
    )
  })

  it('rejects empty option text', () => {
    const emptyOpt = [
      { optionLetter: 'A', optionText: '', isCorrect: true },
      { optionLetter: 'B', optionText: 'Valid', isCorrect: false }
    ]
    assert.throws(
      () => validateMcqQuestion({ ...baseValid, options: emptyOpt }),
      /cannot be empty/i
    )
  })

  it('rejects option text exceeding 500 chars', () => {
    const longOpt = [
      { optionLetter: 'A', optionText: 'x'.repeat(501), isCorrect: true },
      { optionLetter: 'B', optionText: 'Valid', isCorrect: false }
    ]
    assert.throws(
      () => validateMcqQuestion({ ...baseValid, options: longOpt }),
      /500 characters/i
    )
  })
})

describe('P2 MCQ-Only — Bulk Excel Import Normalizer', () => {
  it('normalizes valid Excel row into MCQ format (happy path)', () => {
    const row = {
      Question: 'What is the speed of light?',
      OptionA: '300,000 km/s',
      OptionB: '150,000 km/s',
      OptionC: 'Unknown',
      CorrectOption: 'A',
      Marks: 3,
      NegativeMarks: 1,
      Difficulty: 'EASY',
      Tags: 'physics, optics'
    }

    const normalized = normalizeExcelQuestionRow(row, 2)
    assert.strictEqual(normalized.questionText, 'What is the speed of light?')
    assert.strictEqual(normalized.options.length, 3)
    assert.strictEqual(normalized.options[0].isCorrect, true)
    assert.strictEqual(normalized.options[1].isCorrect, false)
    assert.strictEqual(normalized.marks, 3)
    assert.strictEqual(normalized.negativeMarks, 1)
  })

  it('rejects row missing Question text (sad path)', () => {
    const row = {
      Question: '',
      OptionA: 'Opt A',
      OptionB: 'Opt B',
      CorrectOption: 'A'
    }
    assert.throws(
      () => normalizeExcelQuestionRow(row, 3),
      /Question text is required/i
    )
  })

  it('rejects row where CorrectOption is missing or invalid (sad path)', () => {
    const row = {
      Question: 'Sample question statement?',
      OptionA: 'Opt A',
      OptionB: 'Opt B',
      CorrectOption: 'E'
    }
    assert.throws(
      () => normalizeExcelQuestionRow(row, 4),
      /exactly one correct option/i
    )
  })

  it('rejects row where negativeMarks > marks (sad path)', () => {
    const row = {
      Question: 'Sample statement',
      OptionA: 'Opt A',
      OptionB: 'Opt B',
      CorrectOption: 'A',
      Marks: 1,
      NegativeMarks: 2
    }
    assert.throws(
      () => normalizeExcelQuestionRow(row, 5),
      /cannot exceed.*marks/i
    )
  })
})

describe('P2 MCQ-Only — Publish Rejection Guard', () => {
  it('rejects publishing an exam with 0 questions (400)', async () => {
    const exam = await createTestExam({ title: 'Empty Draft Exam' })

    try {
      await assert.rejects(
        async () => {
          await examService.publishExamById({ id: exam.id, facultyId: exam.facultyId })
        },
        (err) => {
          assert.strictEqual(err.status, 400)
          assert.match(err.message, /At least one question is required/i)
          return true
        }
      )
    } finally {
      await prisma.exam.delete({ where: { id: exam.id } }).catch(() => {})
    }
  })

  it('rejects publishing an exam if any question violates MCQ rules (kills B-04 silent fallback)', async () => {
    const exam = await createTestExam({ title: 'Invalid Question Exam' })

    // Insert question with invalid state (0 options) directly
    await prisma.question.create({
      data: {
        examId: exam.id,
        questionText: 'Broken question without options',
        marks: 5,
        negativeMarks: 0
      }
    })

    try {
      await assert.rejects(
        async () => {
          await examService.publishExamById({ id: exam.id, facultyId: exam.facultyId })
        },
        (err) => {
          assert.strictEqual(err.status, 400)
          assert.match(err.message, /violates MCQ rules/i)
          return true
        }
      )
    } finally {
      await prisma.question.deleteMany({ where: { examId: exam.id } }).catch(() => {})
      await prisma.exam.delete({ where: { id: exam.id } }).catch(() => {})
    }
  })
})

describe('P2 MCQ-Only — Student DTO Security Leak Prevention', () => {
  it('strictly ensures isCorrect is never serialized to student-facing start payloads', async () => {
    const exam = await createTestExam({ title: 'DTO Security Test Exam', status: 'PUBLISHED' })

    const student = await prisma.student.create({
      data: {
        name: 'DTO Test Student',
        email: `dto.student.${Date.now()}@test.local`,
        usn: '1MS22CS' + Math.floor(100 + Math.random() * 899),
        password: 'hashed-password-sample',
        departmentCode: 'CSE',
        semester: 6
      }
    })

    // Create valid MCQ question with QuestionOption records via questionService
    const createdQ = await questionService.addQuestionToExam({
      examId: exam.id,
      facultyId: exam.facultyId,
      data: {
        questionText: 'What is 2 + 2?',
        marks: 2,
        negativeMarks: 0.5,
        difficulty: 'EASY',
        options: [
          { text: '3', isCorrect: false },
          { text: '4', isCorrect: true },
          { text: '5', isCorrect: false }
        ]
      }
    })

    try {
      // Simulate student starting the exam
      const startResult = await studentService.startOrResumeExam({ examId: exam.id, studentId: student.id })
      assert.ok(startResult.questions, 'Must return questions array')
      assert.strictEqual(startResult.questions.length, 1)

      const returnedQ = startResult.questions[0]
      assert.ok(returnedQ.options, 'Must return options array')
      assert.strictEqual(returnedQ.options.length, 3)

      for (const opt of returnedQ.options) {
        // SECURITY VERIFICATION: isCorrect must be undefined / omitted
        assert.strictEqual(
          opt.isCorrect,
          undefined,
          `Security violation: isCorrect leaked in student option ${opt.id}!`
        )
        assert.strictEqual(
          Object.prototype.hasOwnProperty.call(opt, 'isCorrect'),
          false,
          `Security violation: opt object has ownProperty isCorrect!`
        )
      }
    } finally {
      await prisma.answer.deleteMany({ where: { attemptQuestion: { attempt: { examId: exam.id } } } }).catch(() => {})
      await prisma.attemptQuestion.deleteMany({ where: { attempt: { examId: exam.id } } }).catch(() => {})
      await prisma.examAttempt.deleteMany({ where: { examId: exam.id } }).catch(() => {})
      await prisma.questionOption.deleteMany({ where: { questionId: createdQ.id } }).catch(() => {})
      await prisma.question.deleteMany({ where: { examId: exam.id } }).catch(() => {})
      await prisma.student.delete({ where: { id: student.id } }).catch(() => {})
      await prisma.exam.delete({ where: { id: exam.id } }).catch(() => {})
    }
  })
})

describe('P2 MCQ-Only — Database Partial Unique Index Enforcement', () => {
  it('enforces exactly one isCorrect=true per question at the database level', async () => {
    const exam = await createTestExam({ title: 'DB Constraint Test Exam' })

    const question = await prisma.question.create({
      data: {
        examId: exam.id,
        questionText: 'Single correct option constraint check',
        marks: 1,
        negativeMarks: 0
      }
    })

    try {
      // 1. First correct option: succeeds
      await prisma.questionOption.create({
        data: {
          questionId: question.id,
          text: 'First Correct',
          isCorrect: true,
          order: 0
        }
      })

      // 2. Second option that is false: succeeds
      await prisma.questionOption.create({
        data: {
          questionId: question.id,
          text: 'Second Incorrect',
          isCorrect: false,
          order: 1
        }
      })

      // 3. Second option with isCorrect=true: MUST throw DB unique index violation!
      await assert.rejects(
        async () => {
          await prisma.questionOption.create({
            data: {
              questionId: question.id,
              text: 'Second Correct (Illegal)',
              isCorrect: true,
              order: 2
            }
          })
        },
        (err) => {
          assert.ok(
            err.code === 'P2002' || /unique/i.test(err.message),
            `Expected unique index violation, got: ${err.message}`
          )
          return true
        }
      )
    } finally {
      await prisma.questionOption.deleteMany({ where: { questionId: question.id } }).catch(() => {})
      await prisma.question.delete({ where: { id: question.id } }).catch(() => {})
      await prisma.exam.delete({ where: { id: exam.id } }).catch(() => {})
    }
  })
})
