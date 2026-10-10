const path = require('path')
require(path.resolve(__dirname, '../../../proctornet/backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../../../proctornet/backend/.env') })
const { PrismaClient } = require(path.resolve(__dirname, '../../../proctornet/backend/node_modules/@prisma/client'))
const bcrypt = require(path.resolve(__dirname, '../../../proctornet/backend/node_modules/bcryptjs'))

const prisma = new PrismaClient()

async function setupE2EFixture() {
  const commonPassword = 'Password123!'
  const hashedPassword = await bcrypt.hash(commonPassword, 10)

  // 1. Ensure Admin exists
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@proctornet.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123'
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10)

  const crypto = require('crypto')
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedAdminPassword
    },
    create: {
      id: crypto.randomUUID(),
      name: 'ProctorNet Admin',
      email: adminEmail,
      password: hashedAdminPassword
    }
  })

  // 2. Ensure Department exists
  await prisma.department.upsert({
    where: { code: 'CSE' },
    update: {},
    create: {
      code: 'CSE',
      name: 'Computer Science and Engineering'
    }
  })

  // 2. Ensure Faculty exists
  const faculty = await prisma.faculty.upsert({
    where: { email: 'e2e.faculty@proctornet.test' },
    update: {
      password: hashedPassword,
      isApproved: true
    },
    create: {
      id: crypto.randomUUID(),
      name: 'E2E Prof Turing',
      email: 'e2e.faculty@proctornet.test',
      password: hashedPassword,
      departmentCode: 'CSE',
      employeeId: 'E2E-FAC-01',
      isApproved: true
    }
  })

  // 3. Ensure Student exists
  const student = await prisma.student.upsert({
    where: { usn: '1MS22CS001' },
    update: {
      password: hashedPassword,
      approvalStatus: 'APPROVED',
      profileStatus: 'VERIFIED'
    },
    create: {
      id: crypto.randomUUID(),
      name: 'Alice E2E Candidate',
      usn: '1MS22CS001',
      email: 'alice.e2e@proctornet.test',
      password: hashedPassword,
      departmentCode: 'CSE',
      semester: 6,
      approvalStatus: 'APPROVED',
      profileStatus: 'VERIFIED'
    }
  })

  // 4. Ensure Exam exists
  const now = new Date()
  const startTime = new Date(now.getTime() - 10 * 60 * 1000) // 10 minutes ago
  const endTime = new Date(now.getTime() + 180 * 60 * 1000)  // 3 hours ahead

  // Clean prior E2E exam if exists
  const existingExam = await prisma.exam.findFirst({
    where: { title: 'E2E Golden Path Verification Exam' }
  })

  let examId = existingExam?.id
  if (existingExam) {
    await prisma.exam.update({
      where: { id: examId },
      data: {
        startTime,
        endTime,
        status: 'PUBLISHED'
      }
    })
  } else {
    const exam = await prisma.exam.create({
      data: {
        id: crypto.randomUUID(),
        title: 'E2E Golden Path Verification Exam',
        subject: 'Distributed Systems',
        description: 'Automated E2E Verification Examination',
        duration: 90,
        totalMarks: 30,
        startTime,
        endTime,
        status: 'PUBLISHED',
        allowedDepartments: ['CSE'],
        allowedSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
        invId: 'INV-E2E-001',
        invPasswordHash: hashedPassword,
        cameraRequired: true,
        browserLock: false,
        facultyId: faculty.id,
        questions: {
          create: [
            {
              id: crypto.randomUUID(),
              questionText: 'What does CAS stand for in concurrent programming?',
              marks: 10,
              order: 1,
              options: {
                create: [
                  { id: crypto.randomUUID(), text: 'Compare-And-Swap', isCorrect: true, order: 1 },
                  { id: crypto.randomUUID(), text: 'Control-And-Set', isCorrect: false, order: 2 },
                  { id: crypto.randomUUID(), text: 'Compute-And-Store', isCorrect: false, order: 3 },
                  { id: crypto.randomUUID(), text: 'Cache-Allocation-State', isCorrect: false, order: 4 }
                ]
              }
            },
            {
              id: crypto.randomUUID(),
              questionText: 'Which protocol is primarily used for WebRTC signaling?',
              marks: 10,
              order: 2,
              options: {
                create: [
                  { id: crypto.randomUUID(), text: 'WebSocket / HTTP', isCorrect: true, order: 1 },
                  { id: crypto.randomUUID(), text: 'BGP', isCorrect: false, order: 2 },
                  { id: crypto.randomUUID(), text: 'SNMP', isCorrect: false, order: 3 },
                  { id: crypto.randomUUID(), text: 'FTP', isCorrect: false, order: 4 }
                ]
              }
            },
            {
              id: crypto.randomUUID(),
              questionText: 'In distributed systems, which architecture avoids full-mesh O(N^2) WebRTC topologies?',
              marks: 10,
              order: 3,
              options: {
                create: [
                  { id: crypto.randomUUID(), text: 'Selective Forwarding Unit (SFU)', isCorrect: true, order: 1 },
                  { id: crypto.randomUUID(), text: 'Direct P2P Full Mesh', isCorrect: false, order: 2 },
                  { id: crypto.randomUUID(), text: 'Flooding Protocol', isCorrect: false, order: 3 },
                  { id: crypto.randomUUID(), text: 'Gossip Multiplexing', isCorrect: false, order: 4 }
                ]
              }
            }
          ]
        }
      }
    })
    examId = exam.id
  }

  return { admin, adminEmail, adminPassword, student, faculty, examId, commonPassword }
}

module.exports = {
  prisma,
  setupE2EFixture
}
