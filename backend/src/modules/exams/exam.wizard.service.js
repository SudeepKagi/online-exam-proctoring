'use strict'

const bcrypt = require('bcryptjs')
const { prisma, withTransaction } = require('../../infra/postgres/client')
const { generateExamQuestions } = require('./ai.generator')

class ExamWizardService {
  async generateFromPdf({ pdfBase64, pdfBuffer, fileName, count = 10, difficulty = 'MEDIUM', topicHint }) {
    let buffer = pdfBuffer
    if (!buffer && pdfBase64) {
      const cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, '')
      buffer = Buffer.from(cleanBase64, 'base64')
    }

    if (!buffer || buffer.length === 0) {
      const err = new Error('Valid PDF document is required')
      err.status = 400
      throw err
    }

    let extractedText
    try {
      const pdfParse = require('pdf-parse')
      const parsed = await pdfParse(buffer)
      extractedText = parsed?.text || ''
    } catch (_) {
      extractedText = buffer.toString('utf-8').replace(/[^a-zA-Z0-9\s.,?!;:()\-_/]/g, ' ')
    }

    extractedText = (extractedText || '').replace(/\s+/g, ' ').trim()
    const cleanTopic = topicHint || (fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : null) || 'Engineering Subject'

    const genResult = await generateExamQuestions({
      topic: cleanTopic,
      syllabusText: extractedText.slice(0, 4000),
      difficulty,
      count: parseInt(count, 10) || 10
    })

    return {
      status: 'success',
      source: genResult.source,
      topic: cleanTopic,
      count: genResult.questions.length,
      questions: genResult.questions
    }
  }

  async publishWizard(creatorId, data = {}) {
    const {
      title,
      courseCode,
      subjectCode,
      description,
      startTime,
      durationMinutes = 60,
      department,
      semester,
      examCode,
      invigilatorId,
      invigilatorPassword,
      invigilatorCredentials = {},
      questions = []
    } = data

    const cCode = courseCode || subjectCode
    if (!title || !cCode || !startTime) {
      const err = new Error('Subject name, subject code, and start time are required')
      err.status = 400
      throw err
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      const err = new Error('At least one question is required to publish an exam')
      err.status = 400
      throw err
    }

    const dur = Number(durationMinutes) || 60
    const start = new Date(startTime)
    const end = new Date(start.getTime() + dur * 60000)

    const cleanExamCode = examCode || `EXM-${cCode}-${Math.floor(100 + Math.random() * 900)}`
    const invId = invigilatorId || invigilatorCredentials.institutionId || invigilatorCredentials.loginId || `INV-${cCode}-${Math.floor(100 + Math.random() * 900)}`
    const invPass = invigilatorPassword || invigilatorCredentials.password || Math.random().toString(36).slice(-8)
    const invRoom = invigilatorCredentials.room || 'Main Examination Hall'

    return withTransaction(async (tx) => {
      const db = tx || prisma

      const exam = await db.exam.create({
        data: {
          title,
          courseCode: cCode,
          createdById: creatorId,
          startTime: start,
          endTime: end,
          durationMinutes: dur,
          status: 'PUBLISHED',
          proctoringConfig: {
            description: description || null,
            department: department || null,
            semester: semester || null,
            examCode: cleanExamCode,
            invigilatorCredentials: {
              institutionId: invId,
              loginId: invId,
              invigilatorId: invId,
              password: invPass,
              passwordHint: invPass,
              room: invRoom
            },
            cameraRequired: true,
            screenShareRequired: true,
            fullScreenMode: true,
            browserLock: true
          }
        }
      })

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        await db.question.create({
          data: {
            examId: exam.id,
            questionText: q.questionText,
            options: q.options || [],
            correctOptionIndex: Number(q.correctOptionIndex) || 0,
            marks: Number(q.marks) || 1,
            negativeMarks: Number(q.negativeMarks) || 0,
            displayOrder: i
          }
        })
      }

      const activeStudents = await db.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE' }
      })

      const targetSem = semester ? String(semester).replace(/sem\s*/i, '').trim() : null
      let assignedCount = 0

      for (const st of activeStudents) {
        const meta = st.profileMetadata || {}
        const matchesDept = !department ||
          String(meta.department || '').toLowerCase().includes(department.toLowerCase()) ||
          department.toLowerCase().includes(String(meta.department || '').toLowerCase())
        const sSem = String(meta.semester || '').replace(/sem\s*/i, '').trim()
        const matchesSem = !targetSem || sSem === targetSem

        if (matchesDept && matchesSem) {
          await db.examAssignment.upsert({
            where: { examId_userId: { examId: exam.id, userId: st.id } },
            create: { examId: exam.id, userId: st.id, assignedRole: 'STUDENT' },
            update: { assignedRole: 'STUDENT' }
          })
          assignedCount++
        }
      }

      const invEmail = `${invId.toLowerCase().replace(/[^a-z0-9]/g, '')}@proctornet.local`
      const passwordHash = await bcrypt.hash(invPass, 12)

      let invUser = await db.user.findFirst({
        where: { OR: [{ institutionId: invId }, { email: invEmail }] }
      })

      if (invUser) {
        invUser = await db.user.update({
          where: { id: invUser.id },
          data: {
            passwordHash,
            status: 'ACTIVE',
            profileMetadata: {
              ...(invUser.profileMetadata || {}),
              examId: exam.id,
              examCode: cleanExamCode,
              generatedPasswordHint: invPass,
              room: invRoom
            }
          }
        })
      } else {
        invUser = await db.user.create({
          data: {
            email: invEmail,
            institutionId: invId,
            fullName: `Invigilator (${courseCode} - ${invRoom})`,
            role: 'INVIGILATOR',
            status: 'ACTIVE',
            passwordHash,
            profileMetadata: {
              examId: exam.id,
              examCode: cleanExamCode,
              generatedPasswordHint: invPass,
              room: invRoom
            }
          }
        })
      }

      await db.examAssignment.upsert({
        where: { examId_userId: { examId: exam.id, userId: invUser.id } },
        create: { examId: exam.id, userId: invUser.id, assignedRole: 'INVIGILATOR' },
        update: { assignedRole: 'INVIGILATOR' }
      })

      try {
        const { redisClient } = require('../../infra/redis/client')
        const sanitized = questions.map(q => ({
          questionText: q.questionText,
          options: q.options,
          marks: q.marks || 1
        }))
        await redisClient.set(`exam:${exam.id}:questions`, JSON.stringify(sanitized), 'EX', 86400)
      } catch (_) {}

      return {
        exam,
        questionsCount: questions.length,
        assignedCount,
        invigilator: {
          id: invUser.id,
          institutionId: invId,
          password: invPass,
          room: invRoom
        }
      }
    })
  }
}

const examWizardService = new ExamWizardService()
module.exports = { examWizardService, ExamWizardService }
