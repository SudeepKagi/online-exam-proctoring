require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

// Safety Guardrail (§0 Rule 11)
if ((process.env.LOADTEST_ALLOW || '').trim() !== '1') {
  console.error('❌ SAFETY ABORT: Load fixture seeding is blocked unless LOADTEST_ALLOW=1 is explicitly set in environment.')
  process.exit(1)
}

const args = process.argv.slice(2)
const studentCountArg = args.indexOf('--students')
const N_STUDENTS = studentCountArg !== -1 ? parseInt(args[studentCountArg + 1], 10) : 50

async function seed() {
  console.log(`\n🚀 Seeding ProctorNet Load Test Fixture (${N_STUDENTS} students, 1 exam, 50 MCQs)...`)

  // 1. Create or upsert Faculty
  const facultyPasswordHash = await bcrypt.hash('Password123!', 8)
  const faculty = await prisma.faculty.upsert({
    where: { email: 'loadtest-faculty@proctornet.test' },
    update: { isApproved: true },
    create: {
      name: 'Load Test Faculty',
      email: 'loadtest-faculty@proctornet.test',
      password: facultyPasswordHash,
      department: 'CSE',
      employeeId: 'LT-FAC-01',
      isApproved: true,
      approvedAt: new Date(),
    },
  })
  console.log(`✅ Faculty seeded: ${faculty.email}`)

  // 2. Create or upsert Exam with 50 MCQs
  const now = new Date()
  const startTime = new Date(now.getTime() - 10 * 60 * 1000) // Started 10m ago
  const endTime = new Date(now.getTime() + 180 * 60 * 1000) // Ends in 3 hours

  // Cleanup prior loadtest exam if exists
  const existingExam = await prisma.exam.findFirst({
    where: { title: 'loadtest-exam-baseline' },
    include: { questions: true },
  })

  let examId
  if (existingExam) {
    examId = existingExam.id
    console.log(`ℹ️  Existing loadtest exam found (${examId}). Updating window...`)
    await prisma.exam.update({
      where: { id: examId },
      data: {
        startTime,
        endTime,
        status: 'PUBLISHED',
      },
    })
  } else {
    const invPasswordHash = await bcrypt.hash('INV12345', 8)
    const newExam = await prisma.exam.create({
      data: {
        facultyId: faculty.id,
        title: 'loadtest-exam-baseline',
        subject: 'Distributed Systems & Operating Systems',
        description: 'Automated baseline load test examination',
        duration: 90,
        startTime,
        endTime,
        totalMarks: 50,
        negativeMarking: false,
        questionsPerStudent: 50,
        randomiseQuestions: false,
        randomiseOptions: false,
        allowedDepartments: ['CSE'],
        allowedSemesters: [5],
        cameraRequired: false,
        micRequired: false,
        browserLock: false,
        fullScreenMode: false,
        watermarkRequired: false,
        invId: 'INV-LOADTEST',
        invPasswordHash,
        status: 'PUBLISHED',
      },
    })
    examId = newExam.id

    // Seed 50 MCQs
    console.log('📝 Generating 50 MCQ questions...')
    const questionInserts = []
    for (let q = 1; q <= 50; q++) {
      const options = [
        { text: `Deterministic option A for question ${q}`, isCorrect: q % 4 === 1 },
        { text: `Deterministic option B for question ${q}`, isCorrect: q % 4 === 2 },
        { text: `Deterministic option C for question ${q}`, isCorrect: q % 4 === 3 },
        { text: `Deterministic option D for question ${q}`, isCorrect: q % 4 === 0 },
      ]
      questionInserts.push({
        examId,
        type: 'MCQ',
        questionText: `Question ${q}: What is the primary operational characteristic of system invariant ${q}?`,
        options,
        correctAnswer: options.find(o => o.isCorrect).text,
        marks: 1.0,
        negativeMarks: 0.0,
        difficulty: 'MEDIUM',
        order: q,
      })
    }

    for (const qData of questionInserts) {
      await prisma.question.create({ data: qData })
    }
    console.log(`✅ 50 Questions seeded for exam: ${examId}`)
  }

  // 3. Batch seed N Student accounts
  console.log(`👥 Seeding ${N_STUDENTS} student accounts...`)
  const studentPasswordHash = await bcrypt.hash('Student123!', 8)
  const studentCredentials = []

  for (let i = 1; i <= N_STUDENTS; i++) {
    const padded = String(i).padStart(4, '0')
    const usn = `LOADTEST-1MS21CS${padded}`
    const email = `loadtest-student-${i}@proctornet.test`

    const student = await prisma.student.upsert({
      where: { email },
      update: {
        usn,
        password: studentPasswordHash,
        department: 'CSE',
        semester: 5,
        profileStatus: 'VERIFIED',
        approvalStatus: 'APPROVED',
      },
      create: {
        name: `LoadTest Student ${i}`,
        email,
        usn,
        password: studentPasswordHash,
        department: 'CSE',
        semester: 5,
        profileStatus: 'VERIFIED',
        approvalStatus: 'APPROVED',
      },
    })

    studentCredentials.push({
      studentId: student.id,
      email,
      password: 'Student123!',
      usn,
      examId,
    })
  }

  // Write credentials fixture for k6
  const fixtureDir = path.join(__dirname, '../../../reports/load/baseline')
  if (!fs.existsSync(fixtureDir)) {
    fs.mkdirSync(fixtureDir, { recursive: true })
  }
  const fixturePath = path.join(fixtureDir, 'students.json')
  fs.writeFileSync(fixturePath, JSON.stringify(studentCredentials, null, 2))
  console.log(`💾 Saved ${studentCredentials.length} student test fixtures to: ${fixturePath}`)
  console.log(`\n🎉 Load fixture seeding complete. Target Exam ID: ${examId}\n`)
}

seed()
  .catch((err) => {
    console.error('❌ Seeding error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
