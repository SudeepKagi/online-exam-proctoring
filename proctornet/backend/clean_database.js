require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function cleanDatabase() {
  console.log('🧹 Starting Full Database Cleanup...')

  try {
    // Delete in reverse foreign key order to prevent constraint errors
    console.log('Deleting dependent audit logs, evidence, and answers...')
    await prisma.answer.deleteMany({}).catch(e => console.warn('Answer delete warning:', e.message))
    await prisma.identityVerification.deleteMany({}).catch(e => console.warn('IdentityVerification warning:', e.message))
    await prisma.verificationAuditLog.deleteMany({}).catch(e => console.warn('VerificationAuditLog warning:', e.message))
    await prisma.reverificationLog.deleteMany({}).catch(e => console.warn('ReverificationLog warning:', e.message))
    await prisma.collusionReport.deleteMany({}).catch(e => console.warn('CollusionReport warning:', e.message))
    await prisma.chatMessage.deleteMany({}).catch(e => console.warn('ChatMessage warning:', e.message))
    await prisma.invigilatorSession.deleteMany({}).catch(e => console.warn('InvigilatorSession warning:', e.message))
    await prisma.auditLog.deleteMany({}).catch(e => console.warn('AuditLog warning:', e.message))

    console.log('Deleting student exam sessions & questions...')
    await prisma.studentExam.deleteMany({}).catch(e => console.warn('StudentExam warning:', e.message))
    await prisma.question.deleteMany({}).catch(e => console.warn('Question warning:', e.message))

    console.log('Deleting exams...')
    await prisma.exam.deleteMany({}).catch(e => console.warn('Exam warning:', e.message))

    console.log('Deleting users (Students, Faculty, Admins)...')
    await prisma.student.deleteMany({}).catch(e => console.warn('Student warning:', e.message))
    await prisma.faculty.deleteMany({}).catch(e => console.warn('Faculty warning:', e.message))
    await prisma.admin.deleteMany({}).catch(e => console.warn('Admin warning:', e.message))

    console.log('✨ FULL DATABASE CLEANUP COMPLETED SUCCESSFULLY!')
  } catch (err) {
    console.error('❌ Error cleaning database:', err)
  } finally {
    await prisma.$disconnect()
  }
}

cleanDatabase()
