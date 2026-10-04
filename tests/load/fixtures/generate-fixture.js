#!/usr/bin/env node
/**
 * ==============================================================================
 * ProctorNet Bulk Fixture Generator (Phase P10 Task 10.3)
 * High-Speed Deterministic Seeding for Load & Concurrency Testing
 * ==============================================================================
 */

const path = require('path')
module.paths.push(path.resolve(__dirname, '../../../proctornet/backend/node_modules'))
require('dotenv').config({ path: path.resolve(__dirname, '../../../proctornet/backend/.env') })
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const fs = require('fs')

const prisma = new PrismaClient()

// ------------------------------------------------------------------------------
// Safety Guardrails (Section 0 Rule 11 & Section 10.3)
// ------------------------------------------------------------------------------
if ((process.env.LOADTEST_ALLOW || '').trim() !== '1') {
  console.error('\n❌ SAFETY REFUSAL: Fixture generation is blocked unless LOADTEST_ALLOW=1 is explicitly set in environment.\n')
  process.exit(1)
}

const dbUrl = process.env.DATABASE_URL || ''
const allowedHosts = (process.env.RESET_ALLOWED_HOSTS || 'localhost,127.0.0.1,postgres,proctornet-db,supabase.com').split(',')
const hostMatch = allowedHosts.some(h => dbUrl.includes(h))

if (!hostMatch && !process.env.ALLOW_CLOUD_FIXTURE) {
  console.error(`\n❌ SAFETY REFUSAL: Target database host does not match allowed loadtest hosts (${allowedHosts.join(', ')}).\n`)
  process.exit(1)
}

// ------------------------------------------------------------------------------
// CLI Options Parsing
// ------------------------------------------------------------------------------
const args = process.argv.slice(2)
const isCleanup = args.includes('--cleanup')

function getArg(flag, defaultVal) {
  const idx = args.indexOf(flag)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal
}

const N_STUDENTS = parseInt(getArg('--students', '500'), 10)
const N_EXAMS = parseInt(getArg('--exams', '1'), 10)
const N_QUESTIONS = parseInt(getArg('--questions', '50'), 10)

// ------------------------------------------------------------------------------
// Cleanup Routine
// ------------------------------------------------------------------------------
async function cleanup() {
  console.log('\n🧹 [CLEANUP] Purging all prior loadtest fixtures (prefix: loadtest-*)...')

  // Find loadtest exams
  const exams = await prisma.exam.findMany({
    where: { title: { startsWith: 'loadtest-' } },
    select: { id: true }
  })
  const examIds = exams.map(e => e.id)

  if (examIds.length > 0) {
    console.log(`[-] Deleting related records for ${examIds.length} loadtest exam(s)...`)
    await prisma.answer.deleteMany({
      where: { attemptQuestion: { attempt: { examId: { in: examIds } } } }
    })
    await prisma.violationEvent.deleteMany({
      where: { attempt: { examId: { in: examIds } } }
    })
    await prisma.attemptQuestion.deleteMany({
      where: { attempt: { examId: { in: examIds } } }
    })
    await prisma.examResult.deleteMany({
      where: { examId: { in: examIds } }
    })
    await prisma.invigilatorSession.deleteMany({
      where: { examId: { in: examIds } }
    })
    await prisma.chatMessage.deleteMany({
      where: { examId: { in: examIds } }
    })
    await prisma.examAttempt.deleteMany({
      where: { examId: { in: examIds } }
    })
    await prisma.questionOption.deleteMany({
      where: { question: { examId: { in: examIds } } }
    })
    await prisma.question.deleteMany({
      where: { examId: { in: examIds } }
    })
    await prisma.exam.deleteMany({
      where: { id: { in: examIds } }
    })
    await prisma.outboxEvent.deleteMany({})
    await prisma.auditLog.deleteMany({})
  }

  const deletedStudents = await prisma.student.deleteMany({
    where: { email: { startsWith: 'loadtest-' } }
  })
  const deletedFaculty = await prisma.faculty.deleteMany({
    where: { email: { startsWith: 'loadtest-' } }
  })

  console.log(`[✓] Cleanup complete. Removed ${deletedStudents.count} students, ${deletedFaculty.count} faculty.\n`)
}

// ------------------------------------------------------------------------------
// Seeding Routine
// ------------------------------------------------------------------------------
async function generate() {
  console.log(`\n================================================================================`)
  console.log(`🚀 Generating ProctorNet Load Test Fixture`)
  console.log(`   Students: ${N_STUDENTS} | Exams: ${N_EXAMS} | Questions per Exam: ${N_QUESTIONS}`)
  console.log(`================================================================================\n`)

  // Precomputed bcrypt hashes (cost factor 8 is secure yet fast for pre-generation)
  console.log('[+] Precomputing bcrypt password hashes to isolate server throughput...')
  const passwordHash = await bcrypt.hash('Student123!', 8)
  const facultyPasswordHash = await bcrypt.hash('Faculty123!', 8)

  // 1. Seed Department CSE first
  console.log('[+] Ensuring Department CSE exists...')
  await prisma.department.upsert({
    where: { code: 'CSE' },
    update: {},
    create: {
      name: 'Computer Science and Engineering',
      code: 'CSE'
    }
  })

  // 2. Seed Faculty
  console.log('[+] Seeding loadtest faculty account...')
  const faculty = await prisma.faculty.upsert({
    where: { email: 'loadtest-faculty@proctornet.test' },
    update: { isApproved: true },
    create: {
      name: 'LoadTest Faculty Lead',
      email: 'loadtest-faculty@proctornet.test',
      password: facultyPasswordHash,
      departmentCode: 'CSE',
      employeeId: 'LT-FAC-01',
      isApproved: true,
      approvedAt: new Date()
    }
  })

  // 3. Seed Exams & Questions
  const now = new Date()
  const startTime = new Date(now.getTime() - 5 * 60 * 1000) // Started 5 mins ago
  const endTime = new Date(now.getTime() + 180 * 60 * 1000) // Ends in 3 hours

  const createdExams = []

  for (let eIdx = 1; eIdx <= N_EXAMS; eIdx++) {
    const examTitle = `loadtest-exam-${eIdx}`
    console.log(`[+] Seeding exam ${eIdx}/${N_EXAMS}: ${examTitle}...`)

    const exam = await prisma.exam.upsert({
      where: { id: `a0000000-0000-4000-8000-00000000000${eIdx}` },
      update: {
        startTime,
        endTime,
        status: 'PUBLISHED'
      },
      create: {
        id: `a0000000-0000-4000-8000-00000000000${eIdx}`,
        facultyId: faculty.id,
        title: examTitle,
        subject: `Performance Engineering & Reliability ${eIdx}`,
        description: `Automated load simulation exam ${eIdx}`,
        duration: 90,
        startTime,
        endTime,
        totalMarks: N_QUESTIONS,
        negativeMarking: false,
        questionsPerStudent: N_QUESTIONS,
        randomiseQuestions: false,
        randomiseOptions: false,
        allowedDepartments: ['CSE'],
        allowedSemesters: [5],
        cameraRequired: false,
        micRequired: false,
        browserLock: false,
        fullScreenMode: false,
        watermarkRequired: false,
        invId: `INV-LOADTEST-${eIdx}`,
        invPasswordHash: facultyPasswordHash,
        status: 'PUBLISHED'
      }
    })

    // Check if questions already exist
    const existingQCount = await prisma.question.count({ where: { examId: exam.id } })

    if (existingQCount < N_QUESTIONS) {
      console.log(`    Creating ${N_QUESTIONS} MCQs for ${examTitle}...`)
      for (let q = 1; q <= N_QUESTIONS; q++) {
        const question = await prisma.question.create({
          data: {
            examId: exam.id,
            questionText: `Question ${q} (${examTitle}): What is the primary characteristic of concurrency invariant ${q}?`,
            marks: 1.0,
            negativeMarks: 0.0,
            difficulty: 'MEDIUM',
            order: q,
            options: {
              create: [
                { text: `Deterministic option A for question ${q}`, isCorrect: q % 4 === 1, order: 1 },
                { text: `Deterministic option B for question ${q}`, isCorrect: q % 4 === 2, order: 2 },
                { text: `Deterministic option C for question ${q}`, isCorrect: q % 4 === 3, order: 3 },
                { text: `Deterministic option D for question ${q}`, isCorrect: q % 4 === 0, order: 4 }
              ]
            }
          },
          include: { options: true }
        })
      }
    }

    createdExams.push(exam)
  }

  // 4. Seed N Student Accounts
  console.log(`[+] Seeding ${N_STUDENTS} student accounts in batches...`)
  const studentFixtures = []
  const BATCH_SIZE = 100

  for (let b = 0; b < N_STUDENTS; b += BATCH_SIZE) {
    const batchLimit = Math.min(b + BATCH_SIZE, N_STUDENTS)
    const promises = []

    for (let i = b + 1; i <= batchLimit; i++) {
      const padded = String(i).padStart(5, '0')
      const usn = `LT1MS21CS${padded}`
      const email = `loadtest-student-${i}@proctornet.test`
      const assignedExam = createdExams[(i - 1) % createdExams.length]

      promises.push(
        prisma.student.upsert({
          where: { email },
          update: {
            usn,
            password: passwordHash,
            departmentCode: 'CSE',
            semester: 5,
            profileStatus: 'VERIFIED',
            approvalStatus: 'APPROVED'
          },
          create: {
            name: `LoadTest Student ${i}`,
            email,
            usn,
            password: passwordHash,
            departmentCode: 'CSE',
            semester: 5,
            profileStatus: 'VERIFIED',
            approvalStatus: 'APPROVED'
          }
        }).then(student => {
          studentFixtures.push({
            studentId: student.id,
            usn,
            email,
            password: 'Student123!',
            examId: assignedExam.id
          })
        })
      )
    }

    await Promise.all(promises)
    process.stdout.write(`    Seeded ${batchLimit}/${N_STUDENTS} students\r`)
  }
  console.log(`\n[✓] Successfully seeded ${studentFixtures.length} student accounts.`)

  // 5. Pre-warm READY attempts and question permutations
  console.log(`[+] Pre-warming READY attempts via attemptPrewarmJob...`)
  try {
    const { attemptPrewarmJob } = require(path.resolve(__dirname, '../../../proctornet/backend/src/modules/attempts/prewarmJob'))
    for (const exam of createdExams) {
      const prewarmResult = await attemptPrewarmJob.prewarmExam(exam.id)
      console.log(`    Prewarmed ${prewarmResult.prewarmedCount || 0} attempts for ${exam.title}.`)
    }
  } catch (prewarmErr) {
    console.warn('[-] Prewarm notice (will create on-demand if skipped):', prewarmErr.message)
  }

  // 6. Save Fixture Metadata to Disk
  const fixturesDir = path.resolve(__dirname, '../../../reports/load/fixtures')
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true })
  }

  const studentsPath = path.join(fixturesDir, 'students.json')
  const examMetaPath = path.join(fixturesDir, 'exam-meta.json')

  fs.writeFileSync(studentsPath, JSON.stringify(studentFixtures, null, 2))
  fs.writeFileSync(examMetaPath, JSON.stringify({
    exams: createdExams.map(e => ({ id: e.id, title: e.title, questions: N_QUESTIONS })),
    totalStudents: studentFixtures.length,
    generatedAt: new Date().toISOString()
  }, null, 2))

  console.log(`\n💾 Saved student fixtures: ${studentsPath}`)
  console.log(`💾 Saved exam metadata:    ${examMetaPath}`)
  console.log(`\n[✓] Fixture generation completed successfully!\n`)
}

async function main() {
  if (isCleanup) {
    await cleanup()
  }
  await generate()
}

main()
  .catch((err) => {
    console.error('\n❌ Fatal Fixture Error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
