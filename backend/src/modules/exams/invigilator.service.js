'use strict'

const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { prisma } = require('../../infra/postgres/client')

class InvigilatorService {
  async generateInvigilatorForExam(examId, data = {}) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) {
      const err = new Error('Exam not found')
      err.status = 404
      throw err
    }

    const shortId = examId.slice(0, 6)
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
    const room = data.room || data.roomNumber || 'Hall A'
    const fullName = data.fullName || data.name || `Invigilator (${room})`
    const institutionId = data.institutionId || `INV-${suffix}`
    const email = data.email || `invig.${shortId}.${suffix.toLowerCase()}@proctornet.local`
    const rawPassword = data.password || `Invig@${crypto.randomBytes(3).toString('hex')}`

    const passwordHash = await bcrypt.hash(rawPassword, 10)

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        institutionId,
        fullName,
        role: 'INVIGILATOR',
        status: 'ACTIVE',
        passwordHash,
        profileMetadata: {
          examId,
          room,
          generatedPasswordHint: rawPassword
        }
      }
    })

    await prisma.examAssignment.upsert({
      where: {
        examId_userId: { examId, userId: user.id }
      },
      update: { assignedRole: 'INVIGILATOR' },
      create: {
        examId,
        userId: user.id,
        assignedRole: 'INVIGILATOR'
      }
    })

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      institutionId: user.institutionId,
      room,
      password: rawPassword,
      status: user.status
    }
  }

  async listExamInvigilators(examId) {
    const assignments = await prisma.examAssignment.findMany({
      where: {
        examId,
        assignedRole: 'INVIGILATOR'
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            institutionId: true,
            status: true,
            profileMetadata: true,
            createdAt: true
          }
        }
      }
    })

    return assignments.map(a => {
      const u = a.user
      const meta = (u.profileMetadata && typeof u.profileMetadata === 'object') ? u.profileMetadata : {}
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        institutionId: u.institutionId,
        room: meta.room || '—',
        generatedPasswordHint: meta.generatedPasswordHint || null,
        status: u.status,
        createdAt: u.createdAt
      }
    })
  }

  async removeInvigilatorFromExam(examId, userId) {
    await prisma.examAssignment.deleteMany({
      where: { examId, userId, assignedRole: 'INVIGILATOR' }
    })
    return { success: true }
  }
}

const invigilatorService = new InvigilatorService()
module.exports = { invigilatorService, InvigilatorService }
