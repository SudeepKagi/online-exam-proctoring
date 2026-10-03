const test = require('node:test')
const assert = require('node:assert')
const crypto = require('crypto')
const { prisma } = require('../src/infra/postgres/client')

test.describe('P3 Schema & Data Layer — Domain Invariants & DB Constraints', () => {

  let testFacultyId
  let testStudentId
  let testExamId
  let testQuestionId
  let testAttemptId
  let testAttemptQuestionId

  test.before(async () => {
    // Ensure departments exist
    await prisma.department.upsert({
      where: { code: 'CSE' },
      update: {},
      create: { code: 'CSE', name: 'Computer Science' }
    })

    // Create test faculty
    const faculty = await prisma.faculty.create({
      data: {
        name: 'Test Faculty P3',
        email: `faculty-p3-${Date.now()}@test.edu`,
        password: 'hashed_password_placeholder',
        departmentCode: 'CSE',
        employeeId: `EMP-P3-${Date.now()}`
      }
    })
    testFacultyId = faculty.id

    // Create test student
    const student = await prisma.student.create({
      data: {
        name: 'Test Student P3',
        usn: `1TESTP3${Math.floor(Math.random() * 10000)}`,
        email: `student-p3-${Date.now()}@test.edu`,
        password: 'hashed_password_placeholder',
        departmentCode: 'CSE',
        semester: 6
      }
    })
    testStudentId = student.id

    // Create test exam
    const now = new Date()
    const exam = await prisma.exam.create({
      data: {
        title: 'P3 Constraint Verification Exam',
        subject: 'Database Systems',
        facultyId: testFacultyId,
        startTime: now,
        endTime: new Date(now.getTime() + 7200000),
        duration: 90,
        totalMarks: 50,
        invId: `INV-P3-${Date.now()}`,
        invPasswordHash: 'hashed_inv_pass',
        status: 'DRAFT',
        allowedDepartments: ['CSE'],
        allowedSemesters: [6]
      }
    })
    testExamId = exam.id

    // Create valid test question
    const q = await prisma.question.create({
      data: {
        examId: testExamId,
        questionText: 'Which index type supports full-text trigram similarity search in PostgreSQL?',
        marks: 5,
        negativeMarks: 1,
        difficulty: 'MEDIUM',
        order: 1
      }
    })
    testQuestionId = q.id

    // Create test attempt
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: testExamId,
        studentId: testStudentId,
        watermarkSeed: `WM-P3-${Date.now()}`,
        status: 'READY'
      }
    })
    testAttemptId = attempt.id

    // Create test attempt question
    const aq = await prisma.attemptQuestion.create({
      data: {
        attemptId: testAttemptId,
        questionId: testQuestionId,
        displayOrder: 1,
        optionOrder: [0, 1, 2, 3]
      }
    })
    testAttemptQuestionId = aq.id
  })

  test.after(async () => {
    // Clean up test data in proper cascade order
    if (testAttemptId) {
      await prisma.answer.deleteMany({ where: { attemptId: testAttemptId } }).catch(() => {})
      await prisma.attemptQuestion.deleteMany({ where: { attemptId: testAttemptId } }).catch(() => {})
      await prisma.examAttempt.deleteMany({ where: { id: testAttemptId } }).catch(() => {})
    }
    if (testExamId) {
      await prisma.questionOption.deleteMany({ where: { question: { examId: testExamId } } }).catch(() => {})
      await prisma.question.deleteMany({ where: { examId: testExamId } }).catch(() => {})
      await prisma.exam.delete({ where: { id: testExamId } }).catch(() => {})
    }
    if (testFacultyId) {
      await prisma.faculty.delete({ where: { id: testFacultyId } }).catch(() => {})
    }
    if (testStudentId) {
      await prisma.student.delete({ where: { id: testStudentId } }).catch(() => {})
    }
  })

  // -------------------------------------------------------------
  // 1. Mandatory Constraint Verification
  // -------------------------------------------------------------

  test('Database rejects question with marks <= 0 (chk_questions_marks_positive)', async () => {
    await assert.rejects(async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "questions" ("id", "exam_id", "question_text", "marks", "negative_marks", "difficulty", "order", "created_at")
        VALUES (gen_random_uuid(), '${testExamId}'::uuid, 'Test invalid marks', 0, 0, 'EASY', 2, now());
      `)
    }, (err) => {
      return /chk_questions_marks_positive/i.test(err.message) || /violates check constraint/i.test(err.message)
    })
  })

  test('Database rejects question where negative_marks > marks (chk_questions_negative_marks_bound)', async () => {
    await assert.rejects(async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "questions" ("id", "exam_id", "question_text", "marks", "negative_marks", "difficulty", "order", "created_at")
        VALUES (gen_random_uuid(), '${testExamId}'::uuid, 'Test invalid negative marks', 2, 5, 'EASY', 2, now());
      `)
    }, (err) => {
      return /chk_questions_negative_marks_bound/i.test(err.message) || /violates check constraint/i.test(err.message)
    })
  })

  test('Database rejects question where negative_marks < 0 (chk_questions_negative_marks_bound)', async () => {
    await assert.rejects(async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "questions" ("id", "exam_id", "question_text", "marks", "negative_marks", "difficulty", "order", "created_at")
        VALUES (gen_random_uuid(), '${testExamId}'::uuid, 'Test negative marks underflow', 5, -1, 'EASY', 2, now());
      `)
    }, (err) => {
      return /chk_questions_negative_marks_bound/i.test(err.message) || /violates check constraint/i.test(err.message)
    })
  })

  test('Database rejects question with empty or oversized text (chk_questions_text_length)', async () => {
    await assert.rejects(async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "questions" ("id", "exam_id", "question_text", "marks", "negative_marks", "difficulty", "order", "created_at")
        VALUES (gen_random_uuid(), '${testExamId}'::uuid, '', 5, 1, 'EASY', 2, now());
      `)
    }, (err) => {
      return /chk_questions_text_length/i.test(err.message) || /violates check constraint/i.test(err.message)
    })
  })

  test('Database rejects option with empty or oversized text (chk_question_options_text_length)', async () => {
    await assert.rejects(async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "question_options" ("id", "question_id", "text", "is_correct", "order", "created_at")
        VALUES (gen_random_uuid(), '${testQuestionId}'::uuid, '', false, 1, now());
      `)
    }, (err) => {
      return /chk_question_options_text_length/i.test(err.message) || /violates check constraint/i.test(err.message)
    })
  })

  test('Database partial unique index enforces exactly ONE is_correct=true per question', async () => {
    // Insert first correct option
    const opt1 = await prisma.questionOption.create({
      data: {
        questionId: testQuestionId,
        text: 'GIN index with pg_trgm ops',
        isCorrect: true,
        order: 1
      }
    })
    assert.ok(opt1.id)

    // Attempt to insert second correct option for same question
    await assert.rejects(async () => {
      await prisma.questionOption.create({
        data: {
          questionId: testQuestionId,
          text: 'Second correct option (violation)',
          isCorrect: true,
          order: 2
        }
      })
    }, (err) => {
      return /idx_question_single_correct/i.test(err.message) || /unique constraint/i.test(err.message)
    })

    // Clean up opt1
    await prisma.questionOption.delete({ where: { id: opt1.id } }).catch(() => {})
  })

  test('Database rejects duplicate exam_attempt for same student and exam (UNIQUE exam_id, student_id)', async () => {
    await assert.rejects(async () => {
      await prisma.examAttempt.create({
        data: {
          examId: testExamId,
          studentId: testStudentId,
          watermarkSeed: 'WM-DUPLICATE',
          status: 'READY'
        }
      })
    }, (err) => {
      return /unique constraint/i.test(err.message) || /exam_attempts_exam_id_student_id_key/i.test(err.message)
    })
  })

  test('Database rejects duplicate display_order in attempt_questions (UNIQUE attempt_id, display_order)', async () => {
    // Create another question
    const q2 = await prisma.question.create({
      data: {
        examId: testExamId,
        questionText: 'Second question for display order test?',
        marks: 5,
        order: 2
      }
    })

    await assert.rejects(async () => {
      await prisma.attemptQuestion.create({
        data: {
          attemptId: testAttemptId,
          questionId: q2.id,
          displayOrder: 1, // Already used by testAttemptQuestionId!
          optionOrder: [0, 1]
        }
      })
    }, (err) => {
      return /unique constraint/i.test(err.message) || /attempt_questions_attempt_id_display_order_key/i.test(err.message)
    })

    await prisma.question.delete({ where: { id: q2.id } }).catch(() => {})
  })

  test('Database rejects duplicate exam_result for same attempt (UNIQUE attempt_id)', async () => {
    const res1 = await prisma.examResult.create({
      data: {
        attemptId: testAttemptId,
        examId: testExamId,
        score: 45,
        totalMarks: 50,
        correctCount: 9,
        wrongCount: 1,
        unansweredCount: 0,
        percentage: 90
      }
    })
    assert.ok(res1.id)

    await assert.rejects(async () => {
      await prisma.examResult.create({
        data: {
          attemptId: testAttemptId,
          examId: testExamId,
          score: 40,
          totalMarks: 50
        }
      })
    }, (err) => {
      return /unique constraint/i.test(err.message) || /exam_results_attempt_id_key/i.test(err.message)
    })

    await prisma.examResult.delete({ where: { id: res1.id } }).catch(() => {})
  })

  // -------------------------------------------------------------
  // 2. Admin & System Baseline Preservation
  // -------------------------------------------------------------

  test('Admin account is preserved with valid UUID ID and bcrypt hash', async () => {
    const admin = await prisma.admin.findUnique({
      where: { email: 'admin@proctornet.com' }
    })
    assert.ok(admin, 'Admin account must exist')
    assert.match(admin.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Admin ID must be UUID')
    assert.ok(admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$'), 'Password must be valid bcrypt hash')
  })

  test('Platform settings are preserved with canonical configuration keys', async () => {
    const settings = await prisma.platformSetting.findMany()
    assert.ok(settings.length >= 5, 'At least 5 platform settings must be restored')
    const keys = settings.map(s => s.key)
    assert.ok(keys.includes('faceVerificationEnabled'), 'Must include faceVerificationEnabled')
    assert.ok(keys.includes('faceMatchThreshold'), 'Must include faceMatchThreshold')
  })

  test('Canonical departments lookup table contains standard college branches', async () => {
    const depts = await prisma.department.findMany()
    const codes = depts.map(d => d.code)
    assert.ok(codes.includes('CSE'), 'CSE must exist')
    assert.ok(codes.includes('ISE'), 'ISE must exist')
    assert.ok(codes.includes('ECE'), 'ECE must exist')
  })

  // -------------------------------------------------------------
  // 3. EXPLAIN Index Scan Verification for Hot Path Queries
  // -------------------------------------------------------------

  test.describe('EXPLAIN (FORMAT JSON) Hot Query Index Scan Gate', () => {

    test('Query 1: exam_attempts(exam_id, status) uses index scan', async () => {
      const planResult = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off;')
        return await tx.$queryRawUnsafe(`
          EXPLAIN (FORMAT JSON)
          SELECT * FROM exam_attempts
          WHERE exam_id = '${testExamId}'::uuid AND status = 'ACTIVE';
        `)
      })
      const planStr = JSON.stringify(planResult)
      assert.ok(
        planStr.includes('Index Scan') || planStr.includes('Bitmap Index Scan') || planStr.includes('idx_exam_attempts_exam_status') || planStr.includes('exam_attempts_exam_id_student_id_key'),
        `Expected index scan on exam_attempts by exam_id, got: ${planStr}`
      )
    })

    test('Query 2: exam_attempts(student_id, status) uses index scan', async () => {
      const planResult = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off;')
        return await tx.$queryRawUnsafe(`
          EXPLAIN (FORMAT JSON)
          SELECT * FROM exam_attempts
          WHERE student_id = '${testStudentId}'::uuid AND status = 'ACTIVE';
        `)
      })
      const planStr = JSON.stringify(planResult)
      assert.ok(
        planStr.includes('Index Scan') || planStr.includes('Bitmap Index Scan') || planStr.includes('idx_exam_attempts_student_status'),
        `Expected index scan on exam_attempts by student_id, got: ${planStr}`
      )
    })

    test('Query 3: exam_attempts active expiry sweeper uses partial index', async () => {
      const planResult = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off;')
        return await tx.$queryRawUnsafe(`
          EXPLAIN (FORMAT JSON)
          SELECT * FROM exam_attempts
          WHERE status = 'ACTIVE' AND expires_at < now();
        `)
      })
      const planStr = JSON.stringify(planResult)
      assert.ok(
        planStr.includes('Index Scan') || planStr.includes('Bitmap Index Scan') || planStr.includes('idx_exam_attempts_active_expiry'),
        `Expected partial index scan on active exam_attempts expiry sweeper, got: ${planStr}`
      )
    })

    test('Query 4: attempt_questions(attempt_id, display_order) uses index scan', async () => {
      const planResult = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off;')
        return await tx.$queryRawUnsafe(`
          EXPLAIN (FORMAT JSON)
          SELECT * FROM attempt_questions
          WHERE attempt_id = '${testAttemptId}'::uuid
          ORDER BY display_order;
        `)
      })
      const planStr = JSON.stringify(planResult)
      assert.ok(
        planStr.includes('Index Scan') || planStr.includes('Bitmap Index Scan') || planStr.includes('attempt_questions_attempt_id_display_order_key') || planStr.includes('idx_attempt_questions_attempt_display'),
        `Expected index scan on attempt_questions display order, got: ${planStr}`
      )
    })

    test('Query 5: violation_events(attempt_id, server_timestamp DESC) uses index scan', async () => {
      const planResult = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off;')
        return await tx.$queryRawUnsafe(`
          EXPLAIN (FORMAT JSON)
          SELECT * FROM violation_events
          WHERE attempt_id = '${testAttemptId}'::uuid
          ORDER BY server_timestamp DESC;
        `)
      })
      const planStr = JSON.stringify(planResult)
      assert.ok(
        planStr.includes('Index Scan') || planStr.includes('Bitmap Index Scan') || planStr.includes('idx_violation_events_attempt_time'),
        `Expected index scan on violation_events timeline, got: ${planStr}`
      )
    })

    test('Query 6: violation_events pending evidence sweeper uses partial index', async () => {
      const planResult = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off;')
        return await tx.$queryRawUnsafe(`
          EXPLAIN (FORMAT JSON)
          SELECT * FROM violation_events
          WHERE evidence_status = 'PENDING';
        `)
      })
      const planStr = JSON.stringify(planResult)
      assert.ok(
        planStr.includes('Index Scan') || planStr.includes('Bitmap Index Scan') || planStr.includes('idx_violation_events_pending'),
        `Expected partial index scan on pending violation events, got: ${planStr}`
      )
    })

    test('Query 7: chat_messages(exam_id, student_id, id) uses index scan', async () => {
      const planResult = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off;')
        return await tx.$queryRawUnsafe(`
          EXPLAIN (FORMAT JSON)
          SELECT * FROM chat_messages
          WHERE exam_id = '${testExamId}'::uuid AND student_id = '${testStudentId}'::uuid
          ORDER BY id;
        `)
      })
      const planStr = JSON.stringify(planResult)
      assert.ok(
        planStr.includes('Index Scan') || planStr.includes('Bitmap Index Scan') || planStr.includes('idx_chat_messages_exam_student_id'),
        `Expected index scan on chat_messages, got: ${planStr}`
      )
    })

    test('Query 8: audit_logs(actor_id, id DESC) uses index scan', async () => {
      const planResult = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off;')
        return await tx.$queryRawUnsafe(`
          EXPLAIN (FORMAT JSON)
          SELECT * FROM audit_logs
          WHERE actor_id = '${testFacultyId}'::uuid
          ORDER BY id DESC;
        `)
      })
      const planStr = JSON.stringify(planResult)
      assert.ok(
        planStr.includes('Index Scan') || planStr.includes('Bitmap Index Scan') || planStr.includes('idx_audit_logs_actor_id'),
        `Expected index scan on audit_logs by actor_id, got: ${planStr}`
      )
    })
  })
})
