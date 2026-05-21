const { logAudit } = require('../utils/auditLogger')
const { getClientIp, paginate } = require('../utils/helpers')
const bcrypt = require('bcryptjs')

/**
 * POST /api/faculty/exams
 * Create exam with configurations
 */
async function createExam(req, res) {
  try {
    const {
      title, subject, description, startTime, endTime,
      duration, durationMinutes, totalMarks,
      questionsPerStudent,
      negativeMarking, negativeValue,
      randomiseQuestions, randomiseOptions,
      allowedDepartments, allowedSemesters,
      cameraRequired, micRequired, browserLock, fullScreenMode, watermarkRequired,
      tabSwitchLimit
    } = req.body

    // Basic validation
    if (!title || !subject || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required exam details.' })
    }

    // Generate invigilator credentials automatically
    const invId = `INV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    const rawInvPassword = Math.random().toString(36).substr(2, 8)
    const invPasswordHash = await bcrypt.hash(rawInvPassword, 10)

    // Fetch faculty details to get default department
    const faculty = await global.prisma.faculty.findUnique({ where: { id: req.user.id } })

    const durationValue = parseInt(duration || durationMinutes || 90)
    const departments = Array.isArray(allowedDepartments) && allowedDepartments.length > 0
      ? allowedDepartments
      : [faculty.department]
    const semesters = Array.isArray(allowedSemesters) && allowedSemesters.length > 0
      ? allowedSemesters.map(Number)
      : [1, 2, 3, 4, 5, 6, 7, 8]

    const exam = await global.prisma.exam.create({
      data: {
        title, subject, description: description || '',
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        duration: durationValue,
        totalMarks: parseInt(totalMarks) || 0,
        questionsPerStudent: parseInt(questionsPerStudent) || 0,
        facultyId: req.user.id,
        status: 'SCHEDULED',
        invId,
        invPasswordHash,
        allowedDepartments: departments,
        allowedSemesters: semesters,
        cameraRequired: cameraRequired !== undefined ? Boolean(cameraRequired) : true,
        micRequired: micRequired !== undefined ? Boolean(micRequired) : false,
        browserLock: browserLock !== undefined ? Boolean(browserLock) : true,
        fullScreenMode: fullScreenMode !== undefined ? Boolean(fullScreenMode) : true,
        watermarkRequired: watermarkRequired !== undefined ? Boolean(watermarkRequired) : true,
        tabSwitchLimit: tabSwitchLimit !== undefined ? parseInt(tabSwitchLimit) : 3,
        randomiseQuestions: randomiseQuestions !== undefined ? Boolean(randomiseQuestions) : true,
        randomiseOptions: randomiseOptions !== undefined ? Boolean(randomiseOptions) : true,
        negativeMarking: negativeMarking !== undefined ? Boolean(negativeMarking) : false,
        negativeValue: negativeValue !== undefined ? parseFloat(negativeValue) : 0.25,
      }
    })

    logAudit({ userId: req.user.id, userRole: 'faculty', action: 'EXAM_CREATED', details: `Exam: ${title}`, ipAddress: getClientIp(req) })

    res.status(201).json({
      message: 'Exam created successfully',
      exam,
      invCredentials: { invId, password: rawInvPassword }
    })
  } catch (e) {
    console.error('[createExam]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * GET /api/faculty/dashboard
 * Dashboard statistics for faculty
 */
async function getDashboardStats(req, res) {
  try {
    const facultyId = req.user.id
    
    const [activeExams, upcomingExams, totalStudents, flaggedSessions] = await Promise.all([
      global.prisma.exam.count({ where: { facultyId, status: 'IN_PROGRESS' } }),
      global.prisma.exam.count({ where: { facultyId, status: 'SCHEDULED' } }),
      // Count unique students enrolled in their exams
      global.prisma.studentExam.groupBy({
        by: ['studentId'],
        where: { exam: { facultyId } }
      }).then(res => res.length),
      // Count exam results with high severity flags for their exams
      global.prisma.evidenceLog.count({
        where: { studentExam: { exam: { facultyId } }, severity: 'HIGH' }
      })
    ])

    res.json({
      activeExams,
      upcomingExams,
      totalStudents,
      flaggedSessions
    })
  } catch (e) {
    console.error('[faculty getDashboardStats]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * GET /api/faculty/exams
 * List exams created by the faculty
 */
async function listExams(req, res) {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const { skip, take } = paginate(page, limit)

    const where = { facultyId: req.user.id }
    if (status) where.status = status.toUpperCase()

    const [exams, total] = await Promise.all([
      global.prisma.exam.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' }
      }),
      global.prisma.exam.count({ where })
    ])

    res.json({ exams, total, page: parseInt(page), totalPages: Math.ceil(total / take) })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * GET /api/faculty/exams/:id
 * Get single exam details
 */
async function getExam(req, res) {
  try {
    const { id } = req.params
    const exam = await global.prisma.exam.findFirst({
      where: { id, facultyId: req.user.id },
      include: {
        questions: true,
        studentExams: { include: { student: { select: { name: true, usn: true, department: true } } } }
      }
    })
    if (!exam) return res.status(404).json({ error: 'Exam not found or you do not have permission.' })
    res.json({ exam })
  } catch (e) {
    console.error('[getExam]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * PATCH /api/faculty/exams/:id
 * Update exam details
 */
async function updateExam(req, res) {
  try {
    const { id } = req.params
    const updates = req.body

    // Ensure they own it
    const existing = await global.prisma.exam.findFirst({ where: { id, facultyId: req.user.id } })
    if (!existing) return res.status(404).json({ error: 'Exam not found.' })
    
    if (existing.status !== 'SCHEDULED' && existing.status !== 'PAUSED') {
      return res.status(400).json({ error: 'Cannot update an exam that is active or completed.' })
    }

    if (updates.startTime) updates.startTime = new Date(updates.startTime)
    if (updates.endTime) updates.endTime = new Date(updates.endTime)

    const exam = await global.prisma.exam.update({
      where: { id },
      data: updates
    })

    logAudit({ userId: req.user.id, userRole: 'faculty', action: 'EXAM_UPDATED', details: `Exam: ${id}`, ipAddress: getClientIp(req) })

    res.json({ message: 'Exam updated', exam })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * POST /api/faculty/questions
 * Add question to question pool / specific exam
 */
async function addQuestion(req, res) {
  try {
    // examId can come from URL param (:examId) or request body
    const examId = req.params.examId || req.body.examId
    const { type, questionText, options, correctAnswer, marks, negativeMarks, difficulty, codeTemplate, wordLimitMax } = req.body

    if (!examId || !type || !questionText || marks === undefined) {
      return res.status(400).json({ error: 'examId, type, questionText and marks are required.' })
    }

    const existing = await global.prisma.exam.findFirst({ where: { id: examId, facultyId: req.user.id } })
    if (!existing) return res.status(404).json({ error: 'Exam not found.' })

    const question = await global.prisma.question.create({
      data: {
        examId,
        type: type.toUpperCase(),
        questionText,
        options: options || [],
        correctAnswer: correctAnswer || null,
        marks: parseFloat(marks),
        negativeMarks: parseFloat(negativeMarks || 0),
        difficulty: difficulty || 'MEDIUM',
        codeTemplate: codeTemplate || null,
        wordLimitMax: wordLimitMax ? parseInt(wordLimitMax) : null,
      }
    })

    await global.prisma.exam.update({
      where: { id: examId },
      data: { totalMarks: existing.totalMarks + parseFloat(marks) }
    })

    res.status(201).json({ message: 'Question added.', question })
  } catch (e) {
    console.error('[addQuestion]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * GET /api/faculty/questions
 * Step 31: Retrieve question pool for a specific exam or across faculty
 */
async function listQuestions(req, res) {
  try {
    const { examId, page = 1, limit = 50 } = req.query
    const { skip, take } = paginate(page, limit)

    const where = {}
    if (examId) {
      where.examId = examId
      // Ensure faculty owns the exam
      const exam = await global.prisma.exam.findFirst({ where: { id: examId, facultyId: req.user.id } })
      if (!exam) return res.status(404).json({ error: 'Exam not found.' })
    } else {
      // Find all exams by this faculty to get their questions
      const exams = await global.prisma.exam.findMany({ where: { facultyId: req.user.id }, select: { id: true } })
      where.examId = { in: exams.map(e => e.id) }
    }

    const [questions, total] = await Promise.all([
      global.prisma.question.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      global.prisma.question.count({ where })
    ])

    res.json({ questions, total, page: parseInt(page), totalPages: Math.ceil(total / take) })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * POST /api/faculty/questions/bulk
 * Step 32: Bulk upload questions via JSON
 */
async function bulkAddQuestions(req, res) {
  try {
    const { examId, questions } = req.body

    if (!examId || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Invalid payload.' })
    }

    const exam = await global.prisma.exam.findFirst({ where: { id: examId, facultyId: req.user.id } })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })

    let totalMarksAdded = 0
    const dataToInsert = questions.map(q => {
      totalMarksAdded += parseInt(q.marks || 0)
      return {
        examId,
        type: q.type || 'MCQ',
        questionText: q.questionText,
        options: q.options || [],
        correctAnswer: q.correctAnswer || null,
        marks: parseInt(q.marks || 1),
        difficulty: q.difficulty || 'MEDIUM'
      }
    })

    const created = await global.prisma.question.createMany({
      data: dataToInsert
    })

    await global.prisma.exam.update({
      where: { id: examId },
      data: { totalMarks: exam.totalMarks + totalMarksAdded }
    })

    logAudit({ userId: req.user.id, userRole: 'faculty', action: 'BULK_QUESTIONS_ADDED', details: `${created.count} questions added to exam ${examId}` })

    res.status(201).json({ message: `${created.count} questions added successfully.` })
  } catch (e) {
    console.error('[bulkAddQuestions]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * POST /api/faculty/exams/:id/students
 * Step 33: Add students to an exam
 */
async function addStudentsToExam(req, res) {
  try {
    const { id } = req.params
    const { studentIds } = req.body

    if (!Array.isArray(studentIds)) return res.status(400).json({ error: 'studentIds must be an array.' })

    const exam = await global.prisma.exam.findFirst({ where: { id, facultyId: req.user.id } })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })

    // Insert ignoring duplicates
    let addedCount = 0
    for (const sId of studentIds) {
      const exists = await global.prisma.studentExam.findFirst({ where: { examId: id, studentId: sId } })
      if (!exists) {
        // Generate random watermark seed for the student
        const watermarkSeed = Math.random().toString(36).substring(2, 8).toUpperCase()
        await global.prisma.studentExam.create({
          data: {
            examId: id,
            studentId: sId,
            watermarkSeed
          }
        })
        addedCount++
      }
    }

    logAudit({ userId: req.user.id, userRole: 'faculty', action: 'STUDENTS_ENROLLED', details: `${addedCount} students enrolled in exam ${id}` })
    res.status(201).json({ message: `Successfully enrolled ${addedCount} students.` })
  } catch (e) {
    console.error('[addStudentsToExam]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * GET /api/faculty/exams/:id/students
 * Step 34: List students enrolled in an exam
 */
async function listExamStudents(req, res) {
  try {
    const { id } = req.params
    const exam = await global.prisma.exam.findFirst({ where: { id, facultyId: req.user.id } })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })

    const enrollments = await global.prisma.studentExam.findMany({
      where: { examId: id },
      include: {
        student: { select: { id: true, name: true, usn: true, department: true } }
      }
    })

    res.json({ enrollments })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * GET /api/faculty/exams/:id/results
 * Step 35: Get exam results and cheat flags
 */
async function listExamResults(req, res) {
  try {
    const { id } = req.params
    const exam = await global.prisma.exam.findFirst({ where: { id, facultyId: req.user.id } })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })

    const results = await global.prisma.examResult.findMany({
      where: { examId: id },
      include: {
        studentExam: {
          include: {
            student: { select: { name: true, usn: true } },
            evidenceLogs: { select: { severity: true } }
          }
        }
      },
      orderBy: { percentage: 'desc' }
    })

    res.json({ results })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * GET /api/faculty/students
 * List students (either all students in the same department as faculty, or enrolled students)
 * We will return students in the same department for approval
 */
async function listStudents(req, res) {
  try {
    const { status, search, page = 1, limit = 20 } = req.query
    const { skip, take } = paginate(page, limit)

    // Faculty can only view/approve students from their own department
    const faculty = await global.prisma.faculty.findUnique({ where: { id: req.user.id } })

    const where = { department: faculty.department }
    if (status) where.approvalStatus = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { usn: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [students, total] = await Promise.all([
      global.prisma.student.findMany({
        where, skip, take,
        select: { id: true, name: true, usn: true, department: true, semester: true, approvalStatus: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      }),
      global.prisma.student.count({ where })
    ])

    res.json({ students, total, page: parseInt(page), totalPages: Math.ceil(total / take) })
  } catch (e) {
    console.error('[faculty listStudents]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * PATCH /api/faculty/students/:id/approve
 * Approve a student
 */
async function approveStudent(req, res) {
  try {
    const { id } = req.params
    const student = await global.prisma.student.findUnique({ where: { id } })
    if (!student) return res.status(404).json({ error: 'Student not found.' })

    const faculty = await global.prisma.faculty.findUnique({ where: { id: req.user.id } })
    if (student.department !== faculty.department) {
      return res.status(403).json({ error: 'Can only approve students in your department.' })
    }

    const updated = await global.prisma.student.update({
      where: { id },
      data: { approvalStatus: 'APPROVED', approvedBy: req.user.id, approvedAt: new Date() }
    })

    logAudit({ userId: req.user.id, userRole: 'faculty', action: 'STUDENT_APPROVED', details: `Approved student ${student.usn}` })

    res.json({ message: 'Student approved.', student: updated })
  } catch (e) {
    console.error('[faculty approveStudent]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

async function runCollusionCheck(req, res) {
  try {
    const { id } = req.params;
    
    // Query submitted or terminated student exams and include student and answers
    const studentExams = await global.prisma.studentExam.findMany({
      where: {
        examId: id,
        status: { in: ['SUBMITTED', 'TERMINATED'] }
      },
      include: {
        student: true,
        answers: {
          include: {
            question: true
          }
        }
      }
    });

    if (studentExams.length < 2) {
      return res.json({ message: 'Not enough submissions to check collusion.', flags: [] });
    }

    const flags = [];
    const threshold = 0.85; // 85% similarity threshold

    for (let i = 0; i < studentExams.length; i++) {
      for (let j = i + 1; j < studentExams.length; j++) {
        const r1 = studentExams[i];
        const r2 = studentExams[j];
        
        let matches = 0;
        let total = r1.answers.length;

        if (total === 0) continue;

        r1.answers.forEach(a1 => {
          const a2 = r2.answers.find(x => x.questionId === a1.questionId);
          if (!a2) return;

          if (a1.question.type === 'MCQ') {
            if (a1.selectedOption && a2.selectedOption && a1.selectedOption === a2.selectedOption) {
              matches++;
            }
          } else {
            const ans1 = a1.codeAnswer || a1.writtenText || '';
            const ans2 = a2.codeAnswer || a2.writtenText || '';
            if (ans1.trim() && ans2.trim()) {
              const sim = calculateSimilarity(ans1, ans2);
              if (sim > threshold) matches++;
            }
          }
        });

        const similarityIndex = matches / total;
        if (similarityIndex > threshold) {
          flags.push({
            student1: r1.student,
            student2: r2.student,
            similarity: similarityIndex * 100,
            details: `High similarity detected across ${matches}/${total} questions.`
          });
        }
      }
    }

    res.json({ flags });
  } catch (error) {
    console.error('[runCollusionCheck]', error);
    res.status(500).json({ error: 'Collusion check failed.' });
  }
}

function calculateSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - editDistance(longer, shorter)) / parseFloat(longer.length);
}

function editDistance(s1, s2) {
  s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1))
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

/**
 * PATCH /api/faculty/exams/:id/publish
 * Publish an exam (set status to PUBLISHED)
 */
async function publishExam(req, res) {
  try {
    const { id } = req.params
    const existing = await global.prisma.exam.findFirst({ where: { id, facultyId: req.user.id } })
    if (!existing) return res.status(404).json({ error: 'Exam not found.' })

    const questionCount = await global.prisma.question.count({ where: { examId: id } })
    if (questionCount === 0) return res.status(400).json({ error: 'Cannot publish exam with no questions.' })

    // Generate secure random uppercase 8-character credentials
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let rawInvPassword = ''
    for (let i = 0; i < 8; i++) {
      rawInvPassword += characters.charAt(Math.floor(Math.random() * characters.length))
    }

    const invId = `INV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    const invPasswordHash = await bcrypt.hash(rawInvPassword, 10)

    const exam = await global.prisma.exam.update({
      where: { id },
      data: { 
        status: 'PUBLISHED',
        invId,
        invPasswordHash
      }
    })
    logAudit({ userId: req.user.id, userRole: 'faculty', action: 'EXAM_PUBLISHED', details: `Exam: ${id}`, ipAddress: getClientIp(req) })
    
    res.json({ 
      message: 'Exam published.', 
      exam,
      invCredentials: {
        invId,
        password: rawInvPassword
      }
    })
  } catch (e) {
    console.error('[publishExam]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * PATCH /api/faculty/exams/:id/results/release
 * Toggle result visibility for students
 */
async function releaseResults(req, res) {
  try {
    const { id } = req.params
    const { release } = req.body
    const existing = await global.prisma.exam.findFirst({ where: { id, facultyId: req.user.id } })
    if (!existing) return res.status(404).json({ error: 'Exam not found.' })

    await global.prisma.examResult.updateMany({
      where: { examId: id },
      data: { isReleased: Boolean(release), releasedAt: release ? new Date() : null }
    })

    res.json({
      message: release ? 'Results released to students.' : 'Results hidden from students.',
      isReleased: Boolean(release)
    })
  } catch (e) {
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * GET /api/faculty/results/:id
 * Get details for a specific result dossier with properly formatted answers
 */
async function getStudentResult(req, res) {
  try {
    const { id } = req.params
    const result = await global.prisma.examResult.findUnique({
      where: { id },
      include: {
        studentExam: {
          include: {
            student: true,
            exam: true,
            answers: { include: { question: true } },
            evidenceLogs: true
          }
        }
      }
    })
    if (!result) return res.status(404).json({ error: 'Result not found.' })

    // Format the result to map answers directly on the root as the frontend expects
    const formattedResult = {
      ...result,
      answers: result.studentExam.answers.map(ans => ({
        id: ans.id,
        selectedOption: ans.selectedOption,
        codeAnswer: ans.codeAnswer,
        writtenText: ans.writtenText,
        question: ans.question,
        isCorrect: ans.autoScore > 0 || ans.manualScore > 0 || ans.selectedOption === ans.question.correctAnswer,
        marksAwarded: ans.manualScore !== null ? ans.manualScore : ans.autoScore
      }))
    }

    res.json({ result: formattedResult })
  } catch (e) {
    console.error('[getStudentResult]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * DELETE /api/faculty/exams/:id
 */
async function deleteExam(req, res) {
  try {
    const { id } = req.params
    const exam = await global.prisma.exam.findUnique({ where: { id }, select: { facultyId: true, status: true, title: true } })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })
    if (exam.facultyId !== req.user.id) return res.status(403).json({ error: 'Not your exam.' })
    if (exam.status === 'ACTIVE') return res.status(409).json({ error: 'Cannot delete an active exam.' })

    await global.prisma.exam.delete({ where: { id } })
    logAudit({ userId: req.user.id, userRole: 'faculty', action: 'EXAM_DELETED', details: exam.title, ipAddress: getClientIp(req) })
    res.json({ message: 'Exam deleted.' })
  } catch (e) {
    console.error('[deleteExam]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * POST /api/faculty/exams/:id/duplicate
 */
async function duplicateExam(req, res) {
  try {
    const { id } = req.params
    const original = await global.prisma.exam.findUnique({
      where: { id },
      include: { questions: true }
    })
    if (!original) return res.status(404).json({ error: 'Exam not found.' })
    if (original.facultyId !== req.user.id) return res.status(403).json({ error: 'Not your exam.' })

    const { questions, id: _id, createdAt, updatedAt, status, invId, invPasswordHash, ...examData } = original

    // Generate new invigilator credentials
    const invId2 = `INV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    const rawInvPassword = Math.random().toString(36).substr(2, 8)
    const invPasswordHash2 = await require('bcryptjs').hash(rawInvPassword, 10)

    const newExam = await global.prisma.exam.create({
      data: {
        ...examData,
        title: `${original.title} (Copy)`,
        status: 'DRAFT',
        invId: invId2,
        invPasswordHash: invPasswordHash2,
        questions: {
          create: questions.map(({ id: _qid, examId: _eid, createdAt: _ca, ...q }) => q)
        }
      }
    })
    res.status(201).json({ message: 'Exam duplicated.', exam: newExam, invCredentials: { invId: invId2, password: rawInvPassword } })
  } catch (e) {
    console.error('[duplicateExam]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * GET /api/faculty/results
 * All results across all exams created by this faculty
 */
async function listAllResults(req, res) {
  try {
    const exams = await global.prisma.exam.findMany({
      where: { facultyId: req.user.id },
      select: { id: true }
    })
    const examIds = exams.map(e => e.id)

    const results = await global.prisma.examResult.findMany({
      where: { studentExam: { examId: { in: examIds } } },
      include: {
        studentExam: {
          include: {
            student: { select: { id: true, name: true, usn: true } },
            exam: { select: { id: true, title: true, subject: true, totalMarks: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    const formatted = results.map(r => ({
      id: r.id,
      student: r.studentExam.student,
      exam: r.studentExam.exam,
      totalScore: r.totalScore,
      percentage: r.percentage,
      submittedAt: r.studentExam?.submittedAt,
    }))

    res.json({ results: formatted })
  } catch (e) {
    console.error('[listAllResults]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * GET /api/faculty/exams/:examId/questions
 */
async function listExamQuestions(req, res) {
  try {
    const { examId } = req.params
    const exam = await global.prisma.exam.findFirst({ where: { id: examId, facultyId: req.user.id } })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })

    const questions = await global.prisma.question.findMany({
      where: { examId },
      orderBy: { createdAt: 'asc' }
    })
    res.json({ questions, total: questions.length })
  } catch (e) {
    console.error('[listExamQuestions]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * DELETE /api/faculty/questions/:id
 */
async function deleteQuestion(req, res) {
  try {
    const { id } = req.params
    const q = await global.prisma.question.findUnique({ where: { id } })
    if (!q) return res.status(404).json({ error: 'Question not found.' })
    // Verify faculty owns the exam
    const exam = await global.prisma.exam.findFirst({ where: { id: q.examId, facultyId: req.user.id } })
    if (!exam) return res.status(403).json({ error: 'Forbidden.' })
    await global.prisma.question.delete({ where: { id } })
    await global.prisma.exam.update({ where: { id: q.examId }, data: { totalMarks: Math.max(0, exam.totalMarks - q.marks) } })
    res.json({ message: 'Question deleted.' })
  } catch (e) {
    console.error('[deleteQuestion]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * PUT /api/faculty/questions/:id
 */
async function updateQuestion(req, res) {
  try {
    const { id } = req.params
    const q = await global.prisma.question.findUnique({ where: { id } })
    if (!q) return res.status(404).json({ error: 'Question not found.' })
    const exam = await global.prisma.exam.findFirst({ where: { id: q.examId, facultyId: req.user.id } })
    if (!exam) return res.status(403).json({ error: 'Forbidden.' })

    const { questionText, options, correctAnswer, marks, negativeMarks, difficulty, codeTemplate } = req.body
    const updated = await global.prisma.question.update({
      where: { id },
      data: {
        questionText: questionText ?? q.questionText,
        options: options ?? q.options,
        correctAnswer: correctAnswer ?? q.correctAnswer,
        marks: marks !== undefined ? parseFloat(marks) : q.marks,
        negativeMarks: negativeMarks !== undefined ? parseFloat(negativeMarks) : q.negativeMarks,
        difficulty: difficulty ?? q.difficulty,
        codeTemplate: codeTemplate ?? q.codeTemplate,
      }
    })
    // Recalculate total marks for the exam
    const allQ = await global.prisma.question.findMany({ where: { examId: q.examId }, select: { marks: true } })
    const newTotal = allQ.reduce((s, x) => s + x.marks, 0)
    await global.prisma.exam.update({ where: { id: q.examId }, data: { totalMarks: newTotal } })

    res.json({ message: 'Question updated.', question: updated })
  } catch (e) {
    console.error('[updateQuestion]', e)
    res.status(500).json({ error: 'Server error.' })
  }
}

/**
 * POST /api/faculty/exams/:examId/ai-generate
 * Generate questions from text using Groq (LLaMA fast inference)
 */
async function generateQuestionsFromAI(req, res) {
  try {
    const { examId } = req.params
    const { text, numMCQ = 5, numEssay = 2, difficulty = 'MEDIUM', marksPerMCQ = 2, marksPerEssay = 10 } = req.body

    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: 'Please provide at least 50 characters of content.' })
    }

    const exam = await global.prisma.exam.findFirst({ where: { id: examId, facultyId: req.user.id } })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Groq API key not configured.' })

    const systemPrompt = `You are an expert academic exam question generator. Always respond with ONLY valid JSON — no markdown, no code blocks, no extra text.`

    const userPrompt = `Generate exactly ${numMCQ} MCQ questions and ${numEssay} subjective questions at ${difficulty} difficulty from the content below.

Content:
"""
${text.substring(0, 10000)}
"""

Return ONLY this JSON structure (no markdown):
{
  "questions": [
    {
      "type": "MCQ",
      "questionText": "...",
      "options": [
        {"text": "Option A", "isCorrect": false},
        {"text": "Option B", "isCorrect": true},
        {"text": "Option C", "isCorrect": false},
        {"text": "Option D", "isCorrect": false}
      ],
      "correctAnswer": "Option B",
      "marks": ${marksPerMCQ},
      "difficulty": "${difficulty}"
    },
    {
      "type": "SUBJECTIVE",
      "questionText": "...",
      "options": [],
      "correctAnswer": "Key points for grading...",
      "marks": ${marksPerEssay},
      "difficulty": "${difficulty}"
    }
  ]
}`

    const axios = require('axios')
    const groqRes = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 4096,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    const rawText = groqRes.data.choices?.[0]?.message?.content || ''
    // Strip markdown code blocks if present
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[AI] Raw response:', rawText.substring(0, 500))
      return res.status(500).json({ error: 'AI returned invalid format. Try again.' })
    }

    let parsed
    try { parsed = JSON.parse(jsonMatch[0]) }
    catch (parseErr) {
      console.error('[AI] JSON parse error:', parseErr.message)
      return res.status(500).json({ error: 'AI response could not be parsed. Try again.' })
    }

    const questions = parsed.questions || []
    if (questions.length === 0) return res.status(500).json({ error: 'AI generated no questions. Try again.' })

    // Save to DB
    let totalMarksAdded = 0
    const savedQuestions = []
    for (const q of questions) {
      const saved = await global.prisma.question.create({
        data: {
          examId,
          type: (q.type || 'MCQ').toUpperCase(),
          questionText: q.questionText || 'Question',
          options: q.options || [],
          correctAnswer: q.correctAnswer || null,
          marks: parseFloat(q.marks || marksPerMCQ),
          negativeMarks: 0,
          difficulty: q.difficulty || difficulty,
        }
      })
      totalMarksAdded += saved.marks
      savedQuestions.push(saved)
    }

    await global.prisma.exam.update({
      where: { id: examId },
      data: { totalMarks: exam.totalMarks + totalMarksAdded }
    })

    logAudit({ userId: req.user.id, userRole: 'faculty', action: 'AI_QUESTIONS_GENERATED', details: `${savedQuestions.length} questions for exam ${examId}` })

    res.status(201).json({ message: `${savedQuestions.length} questions generated successfully!`, questions: savedQuestions })
  } catch (e) {
    console.error('[generateQuestionsFromAI]', e.response?.data || e.message)
    if (e.response?.status === 401) return res.status(500).json({ error: 'Invalid Groq API key.' })
    if (e.response?.status === 429) return res.status(429).json({ error: 'AI rate limit hit. Please wait a moment and try again.' })
    res.status(500).json({ error: 'AI generation failed: ' + (e.response?.data?.error?.message || e.message) })
  }
}

/**
 * POST /api/faculty/exams/ai-generate-preview
 * Generate questions from text using Groq (database-free for creation wizard preview)
 */
async function generateQuestionsPreview(req, res) {
  try {
    const { text, numMCQ = 5, numEssay = 2, difficulty = 'MEDIUM', marksPerMCQ = 2, marksPerEssay = 10 } = req.body

    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: 'Please provide at least 50 characters of content.' })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Groq API key not configured.' })

    const systemPrompt = `You are an expert academic exam question generator. Always respond with ONLY valid JSON — no markdown, no code blocks, no extra text.`

    const userPrompt = `Generate exactly ${numMCQ} MCQ questions and ${numEssay} subjective questions at ${difficulty} difficulty from the content below.

Content:
"""
${text.substring(0, 10000)}
"""

Return ONLY this JSON structure (no markdown):
{
  "questions": [
    {
      "type": "MCQ",
      "questionText": "...",
      "options": [
        {"text": "Option A", "isCorrect": false},
        {"text": "Option B", "isCorrect": true},
        {"text": "Option C", "isCorrect": false},
        {"text": "Option D", "isCorrect": false}
      ],
      "correctAnswer": "Option B",
      "marks": ${marksPerMCQ},
      "difficulty": "${difficulty}"
    },
    {
      "type": "SUBJECTIVE",
      "questionText": "...",
      "options": [],
      "correctAnswer": "Key points for grading...",
      "marks": ${marksPerEssay},
      "difficulty": "${difficulty}"
    }
  ]
}`

    const axios = require('axios')
    const groqRes = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 4096,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    const rawText = groqRes.data.choices?.[0]?.message?.content || ''
    // Strip markdown code blocks if present
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[AI Preview] Raw response:', rawText.substring(0, 500))
      return res.status(500).json({ error: 'AI returned invalid format. Try again.' })
    }

    let parsed
    try { parsed = JSON.parse(jsonMatch[0]) }
    catch (parseErr) {
      console.error('[AI Preview] JSON parse error:', parseErr.message)
      return res.status(500).json({ error: 'AI response could not be parsed. Try again.' })
    }

    const questions = parsed.questions || []
    if (questions.length === 0) return res.status(500).json({ error: 'AI generated no questions. Try again.' })

    res.json({ message: `${questions.length} questions generated successfully!`, questions })
  } catch (e) {
    console.error('[generateQuestionsPreview]', e.response?.data || e.message)
    if (e.response?.status === 401) return res.status(500).json({ error: 'Invalid Groq API key.' })
    if (e.response?.status === 429) return res.status(429).json({ error: 'AI rate limit hit. Please wait a moment and try again.' })
    res.status(500).json({ error: 'AI generation failed: ' + (e.response?.data?.error?.message || e.message) })
  }
}


/**
 * GET /api/faculty/exams/:id/credentials
 * Return invigilator credentials for an exam.
 * Since the password is hashed and unrecoverable, we reset it to a new random one.
 */
async function getExamCredentials(req, res) {
  try {
    const exam = await global.prisma.exam.findFirst({
      where: { id: req.params.id, facultyId: req.user.id },
      select: { id: true, title: true, invId: true, status: true }
    })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })
    if (!exam.invId) return res.status(400).json({ error: 'This exam has no invigilator credentials yet. Publish it first.' })

    // Generate a fresh password (hash stored, raw returned once)
    const newPassword = Math.random().toString(36).substr(2, 8).toUpperCase()
    const newHash = await bcrypt.hash(newPassword, 10)
    await global.prisma.exam.update({
      where: { id: exam.id },
      data: { invPasswordHash: newHash }
    })

    return res.json({
      invCredentials: { invId: exam.invId, password: newPassword },
      exam: { id: exam.id, title: exam.title }
    })
  } catch (err) {
    console.error('getExamCredentials error:', err)
    return res.status(500).json({ error: 'Failed to retrieve credentials.' })
  }
}

module.exports = {
  getDashboardStats,
  createExam,
  listExams,
  getExam,
  updateExam,
  deleteExam,
  duplicateExam,
  publishExam,
  getExamCredentials,
  addQuestion,
  listQuestions,
  listExamQuestions,
  updateQuestion,
  deleteQuestion,
  bulkAddQuestions,
  addStudentsToExam,
  listExamStudents,
  listExamResults,
  listAllResults,
  releaseResults,
  listStudents,
  approveStudent,
  runCollusionCheck,
  getStudentResult,
  generateQuestionsFromAI,
  generateQuestionsPreview,
}
