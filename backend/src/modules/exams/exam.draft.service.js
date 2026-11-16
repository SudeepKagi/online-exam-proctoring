'use strict'

const { prisma } = require('../../infra/postgres/client')

class ExamDraftService {
  async getDraft(creatorId) {
    if (!creatorId) return null
    const draft = await prisma.examDraft.findUnique({
      where: { creatorId }
    })
    return draft ? { id: draft.id, payload: draft.payload, updatedAt: draft.updatedAt } : null
  }

  async saveDraft(creatorId, payload = {}) {
    if (!creatorId) {
      const err = new Error('creatorId is required to save an exam draft')
      err.status = 400
      throw err
    }
    const cleanPayload = typeof payload === 'object' && payload !== null ? payload : {}
    const draft = await prisma.examDraft.upsert({
      where: { creatorId },
      create: {
        creatorId,
        payload: cleanPayload
      },
      update: {
        payload: cleanPayload,
        updatedAt: new Date()
      }
    })
    return { id: draft.id, payload: draft.payload, updatedAt: draft.updatedAt }
  }

  async deleteDraft(creatorId) {
    if (!creatorId) return { deleted: false }
    await prisma.examDraft.deleteMany({
      where: { creatorId }
    })
    return { deleted: true }
  }
}

const examDraftService = new ExamDraftService()
module.exports = { examDraftService, ExamDraftService }

