const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Cleaning up database (preserving Admin accounts)...')
  
  await prisma.evidenceLog.deleteMany()
  await prisma.reverificationLog.deleteMany()
  await prisma.identityVerification.deleteMany()
  await prisma.answer.deleteMany()
  await prisma.examResult.deleteMany()
  await prisma.studentExam.deleteMany()
  await prisma.question.deleteMany()
  await prisma.chatMessage.deleteMany()
  await prisma.collusionReport.deleteMany()
  await prisma.invigilatorSession.deleteMany()
  await prisma.verificationAuditLog.deleteMany()
  await prisma.biometricOverrideLog.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.exam.deleteMany()
  await prisma.student.deleteMany()
  await prisma.faculty.deleteMany()

  const admins = await prisma.admin.findMany()
  console.log(`Cleanup complete! Preserved ${admins.length} Admin account(s).`)
}

main()
  .catch(e => { console.error('Error cleaning database:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
