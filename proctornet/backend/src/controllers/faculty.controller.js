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
      durationMinutes, totalMarks,
      cameraRequired, micRequired, browserLock, fullScreenMode, watermarkRequired,
      tabSwitchLimit, mobileDetectConfig
    } = req.body

    // Basic validation
    if (!title || !subject || !startTime || !endTime || !durationMinutes) {
      return res.status(400).json({ error: 'Missing required exam details.' })
    }

    // Generate invigilator credentials automatically
    const invId = `INV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    const rawInvPassword = Math.random().toString(36).substr(2, 8)
    const invPasswordHash = await bcrypt.hash(rawInvPassword, 10)

    // Fetch faculty details to get department
    const faculty = await global.prisma.faculty.findUnique({ where: { id: req.user.id } })

    const exam = await global.prisma.exam.create({
      data: {
        title, subject, description, 
        startTime: new Date(startTime), 
        endTime: new Date(endTime), 
        duration: parseInt(durationMinutes), 
        totalMarks: parseInt(totalMarks) || 0,
        facultyId: req.user.id,
        status: 'SCHEDULED',
        invId,
        invPasswordHash,
        allowedDepartments: [faculty.department], // Default to faculty's department
        allowedSemesters: [1, 2, 3, 4, 5, 6, 7, 8], // Default to all semesters
        cameraRequired: cameraRequired !== undefined ? cameraRequired : true,
        micRequired: micRequired !== undefined ? micRequired : true,
        browserLock: browserLock !== undefined ? browserLock : true,
        fullScreenMode: fullScreenMode !== undefined ? fullScreenMode : true,
        watermarkRequired: watermarkRequired !== undefined ? watermarkRequired : true,
        tabSwitchLimit: tabSwitchLimit !== undefined ? parseInt(tabSwitchLimit) : 3,
        mobileDetectConfig: mobileDetectConfig || {}
      }
    })

    logAudit({ userId: req.user.id, userRole: 'faculty', action: 'EXAM_CREATED', details: `Exam: ${title}`, ipAddress: getClientIp(req) })

    res.status(201).json({ 
      message: 'Exam created successfully', 
      exam,
      invCredentials: { invId, password: rawInvPassword } // To be displayed once to the faculty
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
        questions: { select: { id: true, questionText: true, type: true, marks: true } },
        students: { include: { student: { select: { name: true, usn: true, department: true } } } }
      }
    })
    
    if (!exam) return res.status(404).json({ error: 'Exam not found or you do not have permission.' })
    res.json({ exam })
  } catch (e) {
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
    const { examId, type, questionText, options, correctAnswer, marks, difficulty } = req.body

    if (!examId || !type || !questionText || marks === undefined) {
      return res.status(400).json({ error: 'Missing required question details.' })
    }

    const existing = await global.prisma.exam.findFirst({ where: { id: examId, facultyId: req.user.id } })
    if (!existing) return res.status(404).json({ error: 'Exam not found.' })

    const question = await global.prisma.question.create({
      data: {
        examId, type, questionText, 
        options: options || [], 
        correctAnswer: correctAnswer || null,
        marks: parseInt(marks),
        difficulty: difficulty || 'MEDIUM'
      }
    })

    // Update total marks of exam
    await global.prisma.exam.update({
      where: { id: examId },
      data: { totalMarks: existing.totalMarks + parseInt(marks) }
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
    const results = await global.prisma.result.findMany({
      where: { examId: id },
      include: {
        studentExam: { include: { student: true } },
        answers: { include: { question: true } }
      }
    });

    if (results.length < 2) {
      return res.json({ message: 'Not enough submissions to check collusion.', flags: [] });
    }

    const flags = [];
    const threshold = 0.85; // 85% similarity

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const r1 = results[i];
        const r2 = results[j];
        
        let matches = 0;
        let total = r1.answers.length;

        r1.answers.forEach(a1 => {
          const a2 = r2.answers.find(x => x.questionId === a1.questionId);
          if (!a2) return;

          if (a1.question.type === 'MCQ') {
            if (a1.selectedOption === a2.selectedOption) matches++;
          } else {
            const sim = calculateSimilarity(a1.codeAnswer || '', a2.codeAnswer || '');
            if (sim > threshold) matches++;
          }
        });

        if (total > 0) {
          const similarityIndex = matches / total;
          if (similarityIndex > threshold) {
            flags.push({
              student1: r1.studentExam.student,
              student2: r2.studentExam.student,
              similarity: similarityIndex * 100,
              details: `High similarity detected across ${matches}/${total} questions.`
            });
          }
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

async function getStudentResult(req, res) {
  try {
    const { id } = req.params; // Result ID
    const result = await global.prisma.result.findUnique({
      where: { id },
      include: {
        studentExam: {
          include: {
            student: true,
            exam: true,
            evidenceLogs: true
          }
        },
        answers: {
          include: {
            question: true
          }
        }
      }
    });

    if (!result) return res.status(404).json({ error: 'Result not found.' });

    res.json({ result });
  } catch (error) {
    console.error('[getStudentResult]', error);
    res.status(500).json({ error: 'Failed to fetch result dossier.' });
  }
}

module.exports = {
  getDashboardStats,
  createExam,
  listExams,
  getExam,
  updateExam,
  addQuestion,
  listQuestions,
  bulkAddQuestions,
  addStudentsToExam,
  listExamStudents,
  listExamResults,
  listStudents,
  approveStudent,
  runCollusionCheck,
  getStudentResult
}
