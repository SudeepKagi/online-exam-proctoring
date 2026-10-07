#!/usr/bin/env node
'use strict'

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

const CANONICAL_DEPARTMENTS = [
  { code: 'CSE', name: 'Computer Science & Engineering' },
  { code: 'ISE', name: 'Information Science & Engineering' },
  { code: 'ECE', name: 'Electronics & Communication Engineering' },
  { code: 'MECH', name: 'Mechanical Engineering' },
  { code: 'CIVIL', name: 'Civil Engineering' },
  { code: 'AI_DS', name: 'Artificial Intelligence & Data Science' }
]

async function cleanDatabase() {
  console.log('\n=============================================================')
  console.log('   PROCTORNET DATABASE PURGE & FRESH ADMIN INITIALIZATION')
  console.log('=============================================================')

  // 1. Ensure or update primary admin
  console.log('\n[1/5] Ensuring primary administrator account...')
  const crypto = require('crypto')
  const hashedPassword = await bcrypt.hash('Admin@123', 12)
  const existingAdmin = await prisma.admin.findUnique({
    where: { email: 'admin@proctornet.com' }
  })
  let primaryAdmin
  if (existingAdmin) {
    primaryAdmin = await prisma.admin.update({
      where: { email: 'admin@proctornet.com' },
      data: {
        name: 'System Administrator',
        password: hashedPassword
      }
    })
  } else {
    primaryAdmin = await prisma.admin.create({
      data: {
        id: crypto.randomUUID(),
        name: 'System Administrator',
        email: 'admin@proctornet.com',
        password: hashedPassword
      }
    })
  }
  console.log(`[✓] Primary Admin verified: ${primaryAdmin.email} (ID: ${primaryAdmin.id})`)

  // 2. Remove all other admin accounts
  console.log('\n[2/5] Purging secondary and test admin accounts...')
  const deletedAdmins = await prisma.admin.deleteMany({
    where: {
      email: { not: 'admin@proctornet.com' }
    }
  })
  console.log(`[✓] Deleted ${deletedAdmins.count} test admin account(s). Only 'admin@proctornet.com' remains.`)

  // 3. Cascading truncate of transactional and account tables
  console.log('\n[3/5] Truncating all student, faculty, exam, attempt, and violation data...')
  const tablesToTruncate = [
    'attempt_questions',
    'answers',
    'violation_events',
    'exam_results',
    'exam_attempts',
    'question_options',
    'questions',
    'exams',
    'agent_pairings',
    'agent_sessions',
    'agent_rules',
    'device_agent_waivers',
    'invigilator_sessions',
    'chat_messages',
    'students',
    'faculties',
    'announcements',
    'audit_logs',
    'idempotency_keys',
    'processed_events',
    'outbox_events'
  ]

  for (const table of tablesToTruncate) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`)
      console.log(`  - Cleaned table: ${table}`)
    } catch (err) {
      console.warn(`  - Warning cleaning ${table}: ${err.message}`)
    }
  }

  // 4. Clean and normalize departments
  console.log('\n[4/5] Normalizing academic departments...')
  // Remove temporary/test departments
  const canonicalCodes = CANONICAL_DEPARTMENTS.map(d => `'${d.code}'`).join(', ')
  await prisma.$executeRawUnsafe(`DELETE FROM "departments" WHERE "code" NOT IN (${canonicalCodes});`)
  
  for (const dept of CANONICAL_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name },
      create: { code: dept.code, name: dept.name }
    })
  }
  console.log(`[✓] Canonical departments initialized: ${CANONICAL_DEPARTMENTS.map(d => d.code).join(', ')}`)

  // Record audit initialization event
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "audit_logs" ("id", "user_role", "action", "details", "timestamp")
      VALUES (gen_random_uuid(), 'system', 'DATABASE_PURGED', 'All tables cleanly reset for fresh testing. Only admin@proctornet.com preserved.', NOW());
    `)
  } catch (err) {
    // If audit_logs schema uses camelCase column names
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "AuditLog" ("id", "userRole", "action", "details", "timestamp")
        VALUES (gen_random_uuid()::text, 'system', 'DATABASE_PURGED', 'All tables cleanly reset for fresh testing. Only admin@proctornet.com preserved.', NOW());
      `)
    } catch (e) {
      // Non-critical
    }
  }

  // 5. Post-condition verification
  console.log('\n[5/5] Verifying post-conditions...')
  const adminCount = await prisma.admin.count()
  const studentCount = await prisma.student.count()
  const facultyCount = await prisma.faculty.count()
  const examCount = await prisma.exam.count()
  const attemptCount = await prisma.examAttempt.count()
  const violationCount = await prisma.violationEvent.count()
  const deptCount = await prisma.department.count()
  const settingCount = await prisma.platformSetting.count()

  console.log('-------------------------------------------------------------')
  console.log(`Admins Remaining       : ${adminCount} (expected: 1)`)
  console.log(`Students Remaining     : ${studentCount} (expected: 0)`)
  console.log(`Faculties Remaining    : ${facultyCount} (expected: 0)`)
  console.log(`Exams Remaining        : ${examCount} (expected: 0)`)
  console.log(`Attempts Remaining     : ${attemptCount} (expected: 0)`)
  console.log(`Violations Remaining   : ${violationCount} (expected: 0)`)
  console.log(`Departments Available  : ${deptCount} (expected: 6)`)
  console.log(`Platform Settings      : ${settingCount} preserved`)
  console.log('-------------------------------------------------------------')

  if (adminCount !== 1 || studentCount !== 0 || facultyCount !== 0 || examCount !== 0) {
    throw new Error('Post-condition verification failed! Database state is not clean.')
  }

  console.log('\n🎉 SUCCESS: Database completely cleaned!')
  console.log('\n🔑 Your Single Admin Account:')
  console.log('   URL     : http://43.204.45.86/admin/login')
  console.log('   Email   : admin@proctornet.com')
  console.log('   Password: Admin@123')
  console.log('=============================================================\n')
}

cleanDatabase()
  .catch((err) => {
    console.error('❌ Error cleaning database:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
