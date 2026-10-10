import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), 'proctornet/backend/.env') })

import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const { prisma } = require(path.resolve(process.cwd(), 'proctornet/backend/src/infra/postgres/client'))


export const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || 'admin@proctornet.com',
  password: process.env.ADMIN_PASSWORD || 'Admin@123',
  name: 'System Administrator'
}

/**
 * Clean-Room Reset Helper (Prompt 8 §2 U4)
 * Ensures ONLY the admin exists at test start.
 * Everything else is wiped so the test must create all entities
 * exclusively through the UI by the authentic actors.
 */
export async function resetCleanRoom(): Promise<void> {
  // Wipe test transactional records in correct foreign key order
  await prisma.answer.deleteMany().catch(() => {})
  await prisma.violationEvent.deleteMany().catch(() => {})
  await prisma.examAttempt.deleteMany().catch(() => {})
  await prisma.questionOption.deleteMany().catch(() => {})
  await prisma.question.deleteMany().catch(() => {})
  await prisma.exam.deleteMany().catch(() => {})
  await prisma.authSession.deleteMany().catch(() => {})
  await prisma.student.deleteMany().catch(() => {})
  await prisma.faculty.deleteMany().catch(() => {})
  await prisma.department.deleteMany().catch(() => {})

  // Ensure Admin exists with known password
  const hashedPassword = await bcrypt.hash(ADMIN_CREDENTIALS.password, 10)
  await prisma.admin.upsert({
    where: { email: ADMIN_CREDENTIALS.email },
    update: {
      name: ADMIN_CREDENTIALS.name,
      password: hashedPassword,
      mustChangePassword: false
    },
    create: {
      id: crypto.randomUUID(),
      name: ADMIN_CREDENTIALS.name,
      email: ADMIN_CREDENTIALS.email,
      password: hashedPassword,
      mustChangePassword: false
    }
  })
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect()
}
