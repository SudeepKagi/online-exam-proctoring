const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')
const crypto = require('crypto')

const prisma = new PrismaClient()

async function main() {
  console.log('--- Setting up Live Demo Exam for 20:30 IST ---')

  // 1. Ensure Department
  let dept = await prisma.department.findUnique({ where: { code: 'CSE' } })
  if (!dept) {
    dept = await prisma.department.create({
      data: { code: 'CSE', name: 'Computer Science and Engineering' }
    })
  }

  // 2. Faculty
  const facultyPasswordHash = await bcrypt.hash('Faculty@123', 10)
  let faculty = await prisma.faculty.findUnique({ where: { email: 'faculty@proctornet.test' } })
  if (faculty) {
    faculty = await prisma.faculty.update({
      where: { id: faculty.id },
      data: {
        password: facultyPasswordHash,
        isApproved: true,
        isSuspended: false
      }
    })
  } else {
    faculty = await prisma.faculty.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Dr. Ramesh Kumar',
        email: 'faculty@proctornet.test',
        password: facultyPasswordHash,
        departmentCode: 'CSE',
        employeeId: 'FAC-CSE-001',
        isApproved: true,
        isSuspended: false
      }
    })
  }
  console.log('Faculty ready:', faculty.email)

  // 3. Students
  const studentPasswordHash = await bcrypt.hash('Student@123', 10)
  
  let student1 = await prisma.student.findUnique({ where: { usn: '1MS21CS001' } })
  if (student1) {
    student1 = await prisma.student.update({
      where: { id: student1.id },
      data: {
        password: studentPasswordHash,
        approvalStatus: 'APPROVED',
        profileStatus: 'VERIFIED',
        isSuspended: false
      }
    })
  } else {
    student1 = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Aditya Sharma',
        usn: '1MS21CS001',
        email: 'student@proctornet.test',
        password: studentPasswordHash,
        departmentCode: 'CSE',
        semester: 6,
        approvalStatus: 'APPROVED',
        profileStatus: 'VERIFIED',
        isSuspended: false
      }
    })
  }
  console.log('Student 1 ready:', student1.usn, student1.email)

  let student2 = await prisma.student.findUnique({ where: { usn: '1MS21CS002' } })
  if (student2) {
    student2 = await prisma.student.update({
      where: { id: student2.id },
      data: {
        password: studentPasswordHash,
        approvalStatus: 'APPROVED',
        profileStatus: 'VERIFIED',
        isSuspended: false
      }
    })
  } else {
    student2 = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Pooja Verma',
        usn: '1MS21CS002',
        email: 'student2@proctornet.test',
        password: studentPasswordHash,
        departmentCode: 'CSE',
        semester: 6,
        approvalStatus: 'APPROVED',
        profileStatus: 'VERIFIED',
        isSuspended: false
      }
    })
  }
  console.log('Student 2 ready:', student2.usn, student2.email)

  // 4. Invigilator Credentials
  const invId = 'INV-2030'
  const invPassword = 'Invigilator@123'
  const invPasswordHash = await bcrypt.hash(invPassword, 10)

  // 5. Exam at 20:30 IST (15:00 UTC)
  const startTime = new Date('2026-10-06T15:00:00.000Z') // 20:30 IST
  const endTime = new Date('2026-10-06T18:00:00.000Z')   // 23:30 IST

  // Check if exam already exists
  let exam = await prisma.exam.findUnique({
    where: { invId }
  })

  if (exam) {
    await prisma.question.deleteMany({ where: { examId: exam.id } })
    await prisma.examAttempt.deleteMany({ where: { examId: exam.id } })
    exam = await prisma.exam.update({
      where: { id: exam.id },
      data: {
        title: 'CS801: Distributed Systems & Security Exam',
        subject: 'Distributed Systems',
        description: 'Live Proctored Semester Examination on Cloud Systems & Network Security',
        facultyId: faculty.id,
        startTime,
        endTime,
        duration: 60,
        totalMarks: 50,
        status: 'LIVE',
        invPasswordHash,
        cameraRequired: true,
        micRequired: false,
        browserLock: false,
        fullScreenMode: false,
        tabSwitchLimit: 5,
        allowedDepartments: ['CSE'],
        allowedSemesters: [6]
      }
    })
  } else {
    exam = await prisma.exam.create({
      data: {
        id: crypto.randomUUID(),
        title: 'CS801: Distributed Systems & Security Exam',
        subject: 'Distributed Systems',
        description: 'Live Proctored Semester Examination on Cloud Systems & Network Security',
        facultyId: faculty.id,
        startTime,
        endTime,
        duration: 60,
        totalMarks: 50,
        status: 'LIVE',
        invId,
        invPasswordHash,
        cameraRequired: true,
        micRequired: false,
        browserLock: false,
        fullScreenMode: false,
        tabSwitchLimit: 5,
        allowedDepartments: ['CSE'],
        allowedSemesters: [6]
      }
    })
  }
  console.log('Exam created/updated with ID:', exam.id)

  // 6. Questions
  const questionsData = [
    {
      questionText: 'What is the primary role of the Raft Consensus Algorithm in distributed systems?',
      marks: 10,
      negativeMarks: 0,
      order: 1,
      options: [
        { text: 'To achieve Byzantine fault tolerance across untrusted networks', isCorrect: false, order: 1 },
        { text: 'To manage replicated logs across a distributed cluster under fail-stop model', isCorrect: true, order: 2 },
        { text: 'To encrypt inter-node socket payloads with quantum resistance', isCorrect: false, order: 3 },
        { text: 'To compress RPC network messages using gzip', isCorrect: false, order: 4 }
      ]
    },
    {
      questionText: 'In the CAP Theorem, which two properties does a partitioned network (P) force a distributed database to choose between?',
      marks: 10,
      negativeMarks: 0,
      order: 2,
      options: [
        { text: 'Consistency (C) and Availability (A)', isCorrect: true, order: 1 },
        { text: 'Concurrency (C) and Atomicity (A)', isCorrect: false, order: 2 },
        { text: 'Performance (P) and Durability (D)', isCorrect: false, order: 3 },
        { text: 'Security (S) and Linearity (L)', isCorrect: false, order: 4 }
      ]
    },
    {
      questionText: 'Which HTTP status code is used by the ProctorNet fail-closed authorization layer to avoid revealing resource existence to unauthorized actors?',
      marks: 10,
      negativeMarks: 0,
      order: 3,
      options: [
        { text: '403 Forbidden', isCorrect: false, order: 1 },
        { text: '401 Unauthorized', isCorrect: false, order: 2 },
        { text: '404 Not Found', isCorrect: true, order: 3 },
        { text: '422 Unprocessable Entity', isCorrect: false, order: 4 }
      ]
    },
    {
      questionText: 'What mechanism prevents race conditions when multiple autosave requests arrive concurrently for the same attempt?',
      marks: 10,
      negativeMarks: 0,
      order: 4,
      options: [
        { text: 'Revision Compare-And-Swap (CAS) optimistic concurrency control', isCorrect: true, order: 1 },
        { text: 'Dropping all duplicate requests randomly', isCorrect: false, order: 2 },
        { text: 'Client-side local storage timestamping only', isCorrect: false, order: 3 },
        { text: 'Global mutex table locks blocking all transactions', isCorrect: false, order: 4 }
      ]
    },
    {
      questionText: 'Why does WebRTC utilize an SFU (Selective Forwarding Unit) instead of a full-mesh P2P architecture in an invigilated exam?',
      marks: 10,
      negativeMarks: 0,
      order: 5,
      options: [
        { text: 'To eliminate client upload bandwidth explosion as N participants increase', isCorrect: true, order: 1 },
        { text: 'Because browsers cannot encode VP8 video', isCorrect: false, order: 2 },
        { text: 'To disable end-to-end encryption completely', isCorrect: false, order: 3 },
        { text: 'Because WebSockets do not support video data', isCorrect: false, order: 4 }
      ]
    }
  ]

  for (const q of questionsData) {
    const { options, ...qData } = q
    const createdQ = await prisma.question.create({
      data: {
        id: crypto.randomUUID(),
        ...qData,
        examId: exam.id,
        options: {
          create: options.map(opt => ({
            id: crypto.randomUUID(),
            ...opt
          }))
        }
      }
    })
    console.log(`Created Question ${q.order}:`, createdQ.id)
  }

  console.log('\n=============================================')
  console.log('EXAM SETUP COMPLETE!')
  console.log('Exam ID:', exam.id)
  console.log('Title:', exam.title)
  console.log('Status: LIVE')
  console.log('Start Time: 2026-10-06 20:30:00 IST (15:00 UTC)')
  console.log('End Time:   2026-10-06 23:30:00 IST (18:00 UTC)')
  console.log('---------------------------------------------')
  console.log('INVIGILATOR CREDENTIALS:')
  console.log('  Invigilator ID (invId):', invId)
  console.log('  Password:              ', invPassword)
  console.log('  Exam ID:               ', exam.id)
  console.log('---------------------------------------------')
  console.log('STUDENT CREDENTIALS:')
  console.log('  Student 1 USN:         ', student1.usn)
  console.log('  Student 1 Password:    ', 'Student@123')
  console.log('  Student 1 Email:       ', student1.email)
  console.log('  Student 2 USN:         ', student2.usn)
  console.log('  Student 2 Password:    ', 'Student@123')
  console.log('---------------------------------------------')
  console.log('FACULTY CREDENTIALS:')
  console.log('  Email:                 ', faculty.email)
  console.log('  Password:              ', 'Faculty@123')
  console.log('=============================================\n')
}

main().catch(e => {
  console.error('Setup failed:', e)
  process.exit(1)
}).finally(() => {
  prisma.$disconnect()
})
