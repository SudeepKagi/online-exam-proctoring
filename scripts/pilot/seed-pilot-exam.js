'use strict'

const path = require('path')
// Load pilot environment explicitly
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.pilot') })

const { prisma } = require('../../backend/src/infra/postgres/client')
const { examService } = require('../../backend/src/modules/exams/exams.service')

async function seedPilotExam() {
  try {
    // 1. Locate seeded faculty user
    const faculty = await prisma.user.findFirst({
      where: { email: 'faculty@proctornet.com' }
    })

    if (!faculty) {
      throw new Error('Seeded faculty user (faculty@proctornet.com) not found in proctornet_pilot database. Please run npm run db:seed first.')
    }

    // 2. Schedule window: startTime = now + 2 minutes, endTime = now + 3 hours, duration 30
    const now = Date.now()
    const startTime = new Date(now + 2 * 60 * 1000)
    const endTime = new Date(now + 3 * 60 * 60 * 1000)
    const durationMinutes = 30

    // 3. Create exam with proctoringConfig { sebRequired: true } and NO per-exam key
    const exam = await examService.createExam(
      {
        title: 'SEB Verification Pilot Exam',
        courseCode: 'CS401',
        startTime,
        endTime,
        durationMinutes,
        proctoringConfig: {
          sebRequired: true
        }
      },
      faculty.id
    )

    // 4. Add 3 MCQs
    await examService.addQuestion(exam.id, {
      questionText: 'What is the primary cryptographic hash algorithm used for SEB Config Key verification?',
      options: ['SHA-256', 'MD5', 'SHA-1', 'AES-256'],
      correctOptionIndex: 0,
      marks: 1,
      order: 0
    })

    await examService.addQuestion(exam.id, {
      questionText: 'In SEB log mode, what occurs when a student sends a request without the SEB header?',
      options: [
        'Request is logged with matched:false and allowed through',
        'Request is blocked with HTTP 403 Forbidden',
        'Exam is cancelled immediately',
        'Session is terminated without logging'
      ],
      correctOptionIndex: 0,
      marks: 1,
      order: 1
    })

    await examService.addQuestion(exam.id, {
      questionText: 'Which HTTP request header contains the Safe Exam Browser Config Key hash?',
      options: [
        'X-SafeExamBrowser-ConfigKeyHash',
        'X-SEB-Security-Token',
        'X-Browser-Config-Hash',
        'Authorization-SEB'
      ],
      correctOptionIndex: 0,
      marks: 1,
      order: 2
    })

    // 5. Publish exam through service layer
    const published = await examService.publishExam(exam.id)

    // 6. Locate student user for confirmation
    const student = await prisma.user.findFirst({
      where: { email: 'student1@proctornet.com' }
    })

    console.log('==========================================================')
    console.log('   SEB PILOT EXAM CREATED & PUBLISHED SUCCESSFULLY')
    console.log('==========================================================')
    console.log(`Exam ID:        ${published.id}`)
    console.log(`Title:          ${published.title}`)
    console.log(`Status:         ${published.status}`)
    console.log(`Start Time:     ${published.startTime.toISOString()} (now + 2m)`)
    console.log(`End Time:       ${published.endTime.toISOString()} (now + 3h)`)
    console.log(`Duration:       ${published.durationMinutes} minutes`)
    console.log(`sebRequired:    ${Boolean(published.proctoringConfig?.sebRequired)}`)
    console.log(`Faculty Owner:  ${faculty.email} (${faculty.id})`)
    console.log('----------------------------------------------------------')
    console.log(`Student Login:  ${student?.email || 'student1@proctornet.com'} / Password@12345`)
    console.log(`Faculty Login:  ${faculty.email} / Password@12345`)
    console.log('==========================================================')

    return published
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  seedPilotExam()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to seed pilot exam:', err)
      process.exit(1)
    })
}

module.exports = { seedPilotExam }
