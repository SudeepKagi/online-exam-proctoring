const path = require('path')
const crypto = require('crypto')
require(path.resolve(__dirname, '../../../proctornet/backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../../../proctornet/backend/.env') })
const { PrismaClient } = require(path.resolve(__dirname, '../../../proctornet/backend/node_modules/@prisma/client'))
const bcrypt = require(path.resolve(__dirname, '../../../proctornet/backend/node_modules/bcryptjs'))
const { signToken } = require(path.resolve(__dirname, '../../../proctornet/backend/src/utils/jwt'))
const { mediaService } = require(path.resolve(__dirname, '../../../proctornet/backend/src/modules/media/media.service'))

const prisma = new PrismaClient()

async function setupMediaPlaneFixture() {
  const suffix = crypto.randomBytes(4).toString('hex')
  const commonPassword = 'Password123!'
  const hashedPassword = await bcrypt.hash(commonPassword, 10)

  // 1. Department
  const deptCode = `CSE_${suffix}`.slice(0, 16).toUpperCase()
  const dept = await prisma.department.create({
    data: {
      code: deptCode,
      name: `Computer Science Media ${suffix}`
    }
  })

  // 2. Faculty
  const faculty = await prisma.faculty.create({
    data: {
      id: crypto.randomUUID(),
      name: `Dr. Media Turing ${suffix}`,
      email: `faculty_${suffix}@proctornet.test`,
      password: hashedPassword,
      departmentCode: dept.code,
      employeeId: `FAC_MED_${suffix}`.slice(0, 16),
      isApproved: true
    }
  })

  // 3. Exam
  const examId = crypto.randomUUID()
  const invId = `INV_MED_${suffix}`.slice(0, 16)
  const now = new Date()
  const exam = await prisma.exam.create({
    data: {
      id: examId,
      title: `Q6 Real Media Plane SFU Exam ${suffix}`,
      subject: 'Distributed Media SFU',
      description: 'Playwright Real Media SFU Verification',
      duration: 120,
      totalMarks: 100,
      status: 'PUBLISHED',
      startTime: new Date(now.getTime() - 10 * 60 * 1000),
      endTime: new Date(now.getTime() + 180 * 60 * 1000),
      allowedDepartments: [dept.code],
      allowedSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
      invId,
      invPasswordHash: hashedPassword,
      facultyId: faculty.id,
      questions: {
        create: [
          {
            id: crypto.randomUUID(),
            questionText: 'What is the primary role of a Selective Forwarding Unit (SFU)?',
            marks: 10,
            order: 1,
            options: {
              create: [
                { id: crypto.randomUUID(), text: 'Selectively forward media streams to subscribers without transcoding', isCorrect: true, order: 1 },
                { id: crypto.randomUUID(), text: 'Full mesh P2P forwarding', isCorrect: false, order: 2 },
                { id: crypto.randomUUID(), text: 'Central mixing of video tiles', isCorrect: false, order: 3 },
                { id: crypto.randomUUID(), text: 'Static file hosting', isCorrect: false, order: 4 }
              ]
            }
          }
        ]
      }
    }
  })

  // 4. Create 20 Students and 20 ACTIVE Attempts
  const students = []
  for (let i = 0; i < 20; i++) {
    const studentUsn = `1MS22CS${String(i + 1).padStart(3, '0')}_${suffix}`.slice(0, 20)
    const student = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: `Candidate ${i + 1} (${studentUsn})`,
        usn: studentUsn,
        email: `candidate_${i + 1}_${suffix}@proctornet.test`,
        password: hashedPassword,
        departmentCode: dept.code,
        semester: 6,
        approvalStatus: 'APPROVED',
        profileStatus: 'VERIFIED'
      }
    })

    const attempt = await prisma.examAttempt.create({
      data: {
        id: crypto.randomUUID(),
        examId,
        studentId: student.id,
        status: 'ACTIVE',
        watermarkSeed: `wm_${suffix}_${i}`,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 7200 * 1000)
      }
    })

    const studentToken = signToken({
      id: student.id,
      role: 'student',
      name: student.name,
      usn: student.usn
    })

    // Issue LiveKit Media token directly via mediaService for the student
    const mediaTokenData = await mediaService.issueToken(
      { id: student.id, role: 'student', name: student.name, usn: student.usn },
      { examId, attemptId: attempt.id }
    )

    students.push({
      id: student.id,
      studentId: student.id,
      attemptId: attempt.id,
      usn: student.usn,
      name: student.name,
      token: studentToken,
      mediaToken: mediaTokenData.token,
      wsUrl: mediaTokenData.wsUrl
    })
  }

  // 5. Invigilator token and media token
  const invigilatorToken = signToken({
    id: `inv_${invId}`,
    role: 'invigilator',
    examId,
    name: `Invigilator ${invId}`
  })

  const invMediaData = await mediaService.issueToken(
    { id: `inv_${invId}`, role: 'invigilator', examId, name: `Invigilator ${invId}` },
    { examId }
  )

  // 6. Extra fallback student token for TCP/TURN test
  const fallbackMediaData = await mediaService.issueToken(
    { id: students[0].id, role: 'student', name: students[0].name, usn: students[0].usn },
    { examId, attemptId: students[0].attemptId }
  )

  return {
    dept,
    faculty,
    examId,
    invId,
    commonPassword,
    invigilator: {
      id: `inv_${invId}`,
      invId,
      password: commonPassword,
      token: invigilatorToken,
      mediaToken: invMediaData.token,
      wsUrl: invMediaData.wsUrl
    },
    students,
    fallbackToken: fallbackMediaData.token
  }
}

async function cleanupMediaPlaneFixture(fixture) {
  if (!fixture) return
  try {
    const attemptIds = fixture.students.map(s => s.attemptId)
    const studentIds = fixture.students.map(s => s.id)

    await prisma.violationEvent.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
    await prisma.examAttempt.deleteMany({ where: { id: { in: attemptIds } } }).catch(() => {})
    await prisma.questionOption.deleteMany({ where: { question: { examId: fixture.examId } } }).catch(() => {})
    await prisma.question.deleteMany({ where: { examId: fixture.examId } }).catch(() => {})
    await prisma.exam.deleteMany({ where: { id: fixture.examId } }).catch(() => {})
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } }).catch(() => {})
    await prisma.faculty.deleteMany({ where: { id: fixture.faculty.id } }).catch(() => {})
    await prisma.department.deleteMany({ where: { code: fixture.dept.code } }).catch(() => {})
  } catch (err) {
    console.error('Error cleaning up media plane fixture:', err.message)
  }
}

module.exports = {
  prisma,
  setupMediaPlaneFixture,
  cleanupMediaPlaneFixture
}
