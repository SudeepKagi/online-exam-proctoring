'use strict'

/**
 * scripts/ops/cleanup-e2e-fixtures.js
 *
 * Dry-run first cleanup script to remove test fixture accounts and exams
 * seeded during testing (@proctornet.test domain).
 *
 * Usage:
 *   node scripts/ops/cleanup-e2e-fixtures.js                # Dry-run (read-only audit)
 *   node scripts/ops/cleanup-e2e-fixtures.js --execute --confirm "DELETE_PROCTORNET_TEST_FIXTURES"
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') })
const { PrismaClient } = require(path.resolve(__dirname, '../../backend/node_modules/@prisma/client'))

const prisma = new PrismaClient()

async function main() {
  const isExecute = process.argv.includes('--execute')
  const confirmIndex = process.argv.indexOf('--confirm')
  const confirmText = confirmIndex !== -1 ? process.argv[confirmIndex + 1] : ''

  console.log('=============================================================')
  console.log(' ProctorNet Ops â€” Purge Test Fixtures (@proctornet.test)')
  console.log(` Mode: ${isExecute ? 'EXECUTE (DESTRUCTIVE)' : 'DRY-RUN (READ-ONLY AUDIT)'}`)
  console.log('=============================================================\n')

  if (isExecute) {
    const { assertNonProduction } = require('../../backend/src/infra/postgres/assertNonProduction')
    assertNonProduction('cleanup-e2e-fixtures')

    if (confirmText !== 'DELETE_PROCTORNET_TEST_FIXTURES') {
      console.error('[x] Error: Execution requires explicit confirmation flag:')
      console.error('    --execute --confirm "DELETE_PROCTORNET_TEST_FIXTURES"')
      process.exit(1)
    }
  }

  try {
    // 1. Identify test faculty
    const testFaculties = await prisma.faculty.findMany({
      where: { email: { endsWith: '@proctornet.test' } },
      select: { id: true, name: true, email: true }
    })
    console.log(`[1] Found ${testFaculties.length} test faculty account(s):`)
    for (const f of testFaculties) {
      console.log(`    - ID: ${f.id} | Email: ${f.email} | Name: ${f.name}`)
    }

    // 2. Identify test students
    const testStudents = await prisma.student.findMany({
      where: { email: { endsWith: '@proctornet.test' } },
      select: { id: true, name: true, email: true, usn: true }
    })
    console.log(`\n[2] Found ${testStudents.length} test student account(s):`)
    for (const s of testStudents) {
      console.log(`    - ID: ${s.id} | Email: ${s.email} | USN: ${s.usn}`)
    }

    // 3. Identify fixture exams
    const facultyIds = testFaculties.map(f => f.id)
    const testExams = await prisma.exam.findMany({
      where: {
        OR: [
          { facultyId: { in: facultyIds.length ? facultyIds : ['00000000-0000-0000-0000-000000000000'] } },
          { title: { contains: 'Golden Path' } },
          { title: { contains: 'E2E' } }
        ]
      },
      select: { id: true, title: true, status: true }
    })
    console.log(`\n[3] Found ${testExams.length} fixture exam(s):`)
    for (const e of testExams) {
      console.log(`    - ID: ${e.id} | Title: "${e.title}" | Status: ${e.status}`)
    }

    if (!isExecute) {
      console.log('\n-------------------------------------------------------------')
      console.log('[âœ“] DRY-RUN COMPLETE. No data was modified.')
      console.log('To execute this purge, re-run with:')
      console.log('  node scripts/ops/cleanup-e2e-fixtures.js --execute --confirm "DELETE_PROCTORNET_TEST_FIXTURES"')
      console.log('-------------------------------------------------------------\n')
      process.exit(0)
    }

    // Execution phase
    console.log('\n[!] Executing deletion in cascading dependency order...')
    const examIds = testExams.map(e => e.id)
    const studentIds = testStudents.map(s => s.id)

    if (examIds.length > 0) {
      const delAttempts = await prisma.examAttempt.deleteMany({
        where: { examId: { in: examIds } }
      })
      console.log(`  - Deleted ${delAttempts.count} associated exam attempt(s)`)

      const delExams = await prisma.exam.deleteMany({
        where: { id: { in: examIds } }
      })
      console.log(`  - Deleted ${delExams.count} fixture exam(s)`)
    }

    if (studentIds.length > 0) {
      const delStudents = await prisma.student.deleteMany({
        where: { id: { in: studentIds } }
      })
      console.log(`  - Deleted ${delStudents.count} fixture student account(s)`)
    }

    if (facultyIds.length > 0) {
      const delFaculties = await prisma.faculty.deleteMany({
        where: { id: { in: facultyIds } }
      })
      console.log(`  - Deleted ${delFaculties.count} fixture faculty account(s)`)
    }

    console.log('\n=============================================================')
    console.log('ðŸŽ‰ SUCCESS: All test fixtures cleanly purged.')
    console.log('=============================================================\n')
  } catch (err) {
    console.error('\n[FATAL] Error cleaning test fixtures:', err.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

module.exports = { main }

