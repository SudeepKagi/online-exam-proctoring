require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Setting up Live Demo Exam for all students...')

  // 1. Get or create a Faculty
  let faculty = await prisma.faculty.findFirst()
  if (!faculty) {
    const pw = await bcrypt.hash('Faculty@123', 10)
    faculty = await prisma.faculty.create({
      data: {
        name: 'Dr. Ramesh Kumar',
        email: 'ramesh.kumar@proctornet.edu',
        password: pw,
        department: 'Computer Science',
        employeeId: 'EMP-CS-001',
        isApproved: true,
      }
    })
  }

  // 2. Ensure students exist and are approved
  let students = await prisma.student.findMany()
  if (students.length === 0) {
    const sPw = await bcrypt.hash('Student@123', 10)
    for (let i = 1; i <= 5; i++) {
      const usn = `1VE22CS00${i}`
      const s = await prisma.student.create({
        data: {
          name: `Candidate Student ${i}`,
          usn,
          email: `student${i}@proctornet.edu`,
          password: sPw,
          department: 'Computer Science',
          semester: 6,
          approvalStatus: 'APPROVED',
          facePhotoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          idCardPhotoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        }
      })
      students.push(s)
    }
  } else {
    await prisma.student.updateMany({
      data: { approvalStatus: 'APPROVED', isSuspended: false }
    })
  }

  students = await prisma.student.findMany()

  // 3. Upsert Live Demo Exam cleanly
  const invId = 'INV-DEMO-001'
  const invPassword = 'Proctor@123'
  const invPasswordHash = await bcrypt.hash(invPassword, 10)

  const now = new Date()
  const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000) // started 2 hrs ago
  const endTime = new Date(now.getTime() + 6 * 60 * 60 * 1000) // ends in 6 hrs

  let exam = await prisma.exam.findFirst({ where: { invId } })

  if (exam) {
    exam = await prisma.exam.update({
      where: { id: exam.id },
      data: {
        title: 'ProctorNet Comprehensive Live Demo Exam',
        subject: 'CS601 — High Assurance Systems',
        description: 'Comprehensive proctored assessment testing anti-cheating protocols, camera feeds, and LiveKit WebRTC grid.',
        startTime,
        endTime,
        duration: 90,
        totalMarks: 50,
        status: 'ACTIVE',
        cameraRequired: true,
        micRequired: true,
        browserLock: true,
        fullScreenMode: true,
        watermarkRequired: true,
      }
    })
  } else {
    exam = await prisma.exam.create({
      data: {
        title: 'ProctorNet Comprehensive Live Demo Exam',
        subject: 'CS601 — High Assurance Systems',
        description: 'Comprehensive proctored assessment testing anti-cheating protocols, camera feeds, and LiveKit WebRTC grid.',
        facultyId: faculty.id,
        startTime,
        endTime,
        duration: 90,
        totalMarks: 50,
        invId,
        invPasswordHash,
        status: 'ACTIVE',
        cameraRequired: true,
        micRequired: true,
        browserLock: true,
        fullScreenMode: true,
        watermarkRequired: true,
        allowedDepartments: ['CS', 'IS', 'ECE'],
        allowedSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
      }
    })
  }

  // 4. Ensure 5 Questions exist for this exam
  let existingQuestions = await prisma.question.findMany({ where: { examId: exam.id } })
  if (existingQuestions.length === 0) {
    const questionsData = [
      {
        type: 'MCQ',
        questionText: 'Which protocol is primarily used by ProctorNet for real-time video stream inspection?',
        options: JSON.stringify(['HTTP/1.1', 'WebRTC / LiveKit SFU', 'FTP Tunneling', 'SMTP Relay']),
        correctAnswer: 'WebRTC / LiveKit SFU',
        marks: 5,
      },
      {
        type: 'MCQ',
        questionText: 'What is the primary function of the local BYOD companion agent running on port 49152?',
        options: JSON.stringify(['Store passwords', 'Scan for prohibited remote desktop background processes', 'Format hard drive', 'Render WebGL graphics']),
        correctAnswer: 'Scan for prohibited remote desktop background processes',
        marks: 5,
      },
      {
        type: 'MCQ',
        questionText: 'Which AI model framework is utilized for continuous candidate face detection?',
        options: JSON.stringify(['face-api.js / TinyFaceDetector', 'TensorFlow 1.0', 'OpenCV 2', 'PyTorch Mobile']),
        correctAnswer: 'face-api.js / TinyFaceDetector',
        marks: 5,
      },
      {
        type: 'SUBJECTIVE',
        questionText: 'Explain how full-screen kiosk isolation and screen watermark overlay protect examination integrity.',
        marks: 15,
        wordLimitMin: 30,
        wordLimitMax: 150,
      },
      {
        type: 'SUBJECTIVE',
        questionText: 'Describe the 4-stage automated security check pipeline before joining a live exam.',
        marks: 20,
        wordLimitMin: 40,
        wordLimitMax: 200,
      }
    ]

    for (const q of questionsData) {
      await prisma.question.create({
        data: { examId: exam.id, ...q }
      })
    }
  }

  existingQuestions = await prisma.question.findMany({ where: { examId: exam.id } })
  const questionIds = existingQuestions.map(q => q.id)

  // 5. Enroll ALL students into this demo exam cleanly
  for (const s of students) {
    const existingSE = await prisma.studentExam.findFirst({
      where: { studentId: s.id, examId: exam.id }
    })

    if (existingSE) {
      await prisma.studentExam.update({
        where: { id: existingSE.id },
        data: {
          status: 'ACTIVE',
          assignedQuestionIds: questionIds,
        }
      })
    } else {
      await prisma.studentExam.create({
        data: {
          studentId: s.id,
          examId: exam.id,
          assignedQuestionIds: questionIds,
          status: 'ACTIVE',
          watermarkSeed: 'WM-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        }
      })
    }
  }

  console.log('✅ LIVE DEMO EXAM CREATION COMPLETE!')
  console.log(`\n📌 EXAM DETAILS:`)
  console.log(`Exam Title:     ${exam.title}`)
  console.log(`Exam ID:        ${exam.id}`)
  console.log(`Status:         LIVE NOW`)

  console.log(`\n🛡️ INVIGILATOR ACCESS CREDENTIALS:`)
  console.log(`Portal URL:     http://localhost:5173/invigilator-login`)
  console.log(`Exam ID:        ${exam.id}`)
  console.log(`Invigilator ID: ${invId}`)
  console.log(`Password:       ${invPassword}`)

  console.log(`\n🎓 STUDENT LOGIN CREDENTIALS:`)
  for (const s of students.slice(0, 5)) {
    console.log(`Name: ${s.name} | USN: ${s.usn} | Password: Student@123`)
  }
}

main()
  .catch(e => {
    console.error('Error in create_live_demo_test:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
