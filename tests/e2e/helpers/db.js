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

  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedAdminPassword
    },
    create: {
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
              questionText: 'What does CAS stand for in concurrent programming?',
              marks: 10,
              order: 1,
              options: {
                create: [
                  { text: 'Compare-And-Swap', isCorrect: true, order: 1 },
                  { text: 'Control-And-Set', isCorrect: false, order: 2 },
                  { text: 'Compute-And-Store', isCorrect: false, order: 3 },
                  { text: 'Cache-Allocation-State', isCorrect: false, order: 4 }
                ]
              }
            },
            {
              questionText: 'Which protocol is primarily used for WebRTC signaling?',
              marks: 10,
              order: 2,
              options: {
                create: [
                  { text: 'WebSocket / HTTP', isCorrect: true, order: 1 },
                  { text: 'BGP', isCorrect: false, order: 2 },
                  { text: 'SNMP', isCorrect: false, order: 3 },
                  { text: 'FTP', isCorrect: false, order: 4 }
                ]
              }
            },
            {
              questionText: 'In distributed systems, which architecture avoids full-mesh O(N^2) WebRTC topologies?',
              marks: 10,
              order: 3,
              options: {
                create: [
                  { text: 'Selective Forwarding Unit (SFU)', isCorrect: true, order: 1 },
                  { text: 'Direct P2P Full Mesh', isCorrect: false, order: 2 },
                  { text: 'Flooding Protocol', isCorrect: false, order: 3 },
                  { text: 'Gossip Multiplexing', isCorrect: false, order: 4 }
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
