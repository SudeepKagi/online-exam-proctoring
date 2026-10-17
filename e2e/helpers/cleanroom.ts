import path from 'path'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') })

const { prisma } = require(path.resolve(process.cwd(), 'backend/src/infra/postgres/client'))

export const ADMIN_CREDENTIALS = {
  email: 'admin@proctornet.com',
  password: 'Admin@12345',
  name: 'System Administrator'
}

export const SEEDED_FACULTY = {
  email: 'faculty@proctornet.com',
  password: 'Password@12345',
  name: 'Prof. Alan Turing'
}

export const SEEDED_INVIGILATOR = {
  email: 'invigilator@proctornet.com',
  password: 'Password@12345',
  name: 'Chief Invigilator Grace'
}

export const SEEDED_STUDENTS = [
  { email: 'student1@proctornet.com', usn: 'USN-001', password: 'Password@12345', name: 'Alice Johnson' },
  { email: 'student2@proctornet.com', usn: 'USN-002', password: 'Password@12345', name: 'Bob Smith' }
]

export async function resetCleanRoom(): Promise<void> {
  // Wipe test transactional records in correct foreign key order
  await prisma.attemptAnswer.deleteMany().catch(() => {})
  await prisma.proctoringLog.deleteMany().catch(() => {})
  await prisma.examAttempt.deleteMany().catch(() => {})
  await prisma.examAssignment.deleteMany().catch(() => {})
  await prisma.question.deleteMany().catch(() => {})
  await prisma.exam.deleteMany().catch(() => {})

  // Re-seed standard 5 accounts if missing
  const adminHash = await bcrypt.hash(ADMIN_CREDENTIALS.password, 10)
  await prisma.user.upsert({
    where: { email: ADMIN_CREDENTIALS.email },
    update: { fullName: ADMIN_CREDENTIALS.name, passwordHash: adminHash, role: 'ADMIN', status: 'ACTIVE' },
    create: { email: ADMIN_CREDENTIALS.email, fullName: ADMIN_CREDENTIALS.name, passwordHash: adminHash, role: 'ADMIN', status: 'ACTIVE' }
  })

  const passHash = await bcrypt.hash('Password@12345', 10)
  await prisma.user.upsert({
    where: { email: SEEDED_FACULTY.email },
    update: { fullName: SEEDED_FACULTY.name, passwordHash: passHash, role: 'FACULTY', status: 'ACTIVE' },
    create: { email: SEEDED_FACULTY.email, fullName: SEEDED_FACULTY.name, passwordHash: passHash, role: 'FACULTY', status: 'ACTIVE' }
  })

  await prisma.user.upsert({
    where: { email: SEEDED_INVIGILATOR.email },
    update: { fullName: SEEDED_INVIGILATOR.name, passwordHash: passHash, role: 'INVIGILATOR', status: 'ACTIVE' },
    create: { email: SEEDED_INVIGILATOR.email, fullName: SEEDED_INVIGILATOR.name, passwordHash: passHash, role: 'INVIGILATOR', status: 'ACTIVE' }
  })

  for (const s of SEEDED_STUDENTS) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: { fullName: s.name, passwordHash: passHash, role: 'STUDENT', status: 'ACTIVE', institutionId: s.usn },
      create: { email: s.email, fullName: s.name, passwordHash: passHash, role: 'STUDENT', status: 'ACTIVE', institutionId: s.usn }
    })
  }
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect().catch(() => {})
}
