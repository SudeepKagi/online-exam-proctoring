'use strict'

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { prisma } = require('../../src/infra/postgres/client')
const { getRedisClient } = require('../../src/infra/redis/client')

async function cleanDatabaseKeepAdmin() {
  console.log('\n🧹 Cleaning ProctorNet database (keeping Administrator / Admin Portal only)...\n')

  try {
    // 1. Delete dependent relational tables
    const delLogs = await prisma.proctoringLog.deleteMany({})
    console.log(`🗑️  Deleted ${delLogs.count} proctoring logs`)

    const delAnswers = await prisma.attemptAnswer.deleteMany({})
    console.log(`🗑️  Deleted ${delAnswers.count} attempt answers`)

    const delAttempts = await prisma.examAttempt.deleteMany({})
    console.log(`🗑️  Deleted ${delAttempts.count} exam attempts`)

    const delAssignments = await prisma.examAssignment.deleteMany({})
    console.log(`🗑️  Deleted ${delAssignments.count} exam assignments`)

    const delQuestions = await prisma.question.deleteMany({})
    console.log(`🗑️  Deleted ${delQuestions.count} questions`)

    const delExams = await prisma.exam.deleteMany({})
    console.log(`🗑️  Deleted ${delExams.count} exams`)

    // 2. Delete all non-admin users
    const delUsers = await prisma.user.deleteMany({
      where: {
        role: {
          not: 'ADMIN'
        }
      }
    })
    console.log(`🗑️  Deleted ${delUsers.count} non-admin users (students, faculty, invigilators)`)

    // 3. Ensure the primary Administrator exists and is reset to known clean credentials
    const adminHash = await bcrypt.hash('Admin@12345', 10)
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@proctornet.com' },
      update: {
        fullName: 'System Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
        institutionId: 'ADMIN-001',
        passwordHash: adminHash,
        profileMetadata: null,
        referencePhotoKey: null,
        idCardPhotoKey: null
      },
      create: {
        email: 'admin@proctornet.com',
        fullName: 'System Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
        institutionId: 'ADMIN-001',
        passwordHash: adminHash
      }
    })
    console.log(`✅ Administrator verified & reset: ${adminUser.email} (Role: ${adminUser.role})`)

    // 4. Verify post-cleanup database state
    const remainingUsers = await prisma.user.findMany({ select: { id: true, email: true, role: true, status: true } })
    const remainingExams = await prisma.exam.count()
    const remainingAttempts = await prisma.examAttempt.count()

    console.log('\n📊 Database State Summary Post-Cleanup:')
    console.log(`   - Users remaining: ${remainingUsers.length} (Only ADMIN: ${remainingUsers.map(u => u.email).join(', ')})`)
    console.log(`   - Exams remaining: ${remainingExams}`)
    console.log(`   - Attempts remaining: ${remainingAttempts}`)

    // 5. Flush Redis cache to ensure no stale keys
    try {
      const redis = getRedisClient()
      if (redis && redis.status === 'ready') {
        await redis.flushall()
        console.log('🧹 Redis cache flushed cleanly')
      } else {
        console.log('ℹ️  Redis not active in this process, skipping in-script redis flush')
      }
    } catch (redisErr) {
      console.warn('⚠️  Redis flush skipped:', redisErr.message)
    }

    console.log('\n✨ Database cleaned successfully! The Admin Portal is ready for clean production operation.\n')
  } catch (error) {
    console.error('❌ Database cleanup failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

cleanDatabaseKeepAdmin()
