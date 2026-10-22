const { prisma } = require('../../infra/postgres/client')
const { mediaService } = require('./media.service')

class NotFoundError extends Error {
  constructor(message = 'Attempt not found') {
    super(message)
    this.name = 'NotFoundError'
    this.status = 404
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
    this.status = 403
  }
}

class PresignService {
  async generateLiveSnapshotTicket(user, { attemptId }) {
    if (!attemptId) throw new NotFoundError('Attempt ID required')
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId }
    })
    if (!attempt) {
      throw new NotFoundError(`Attempt ${attemptId} not found`)
    }

    return mediaService.generatePresignedUpload({
      purpose: 'LIVE_FRAME',
      attemptId,
      contentType: 'image/webp'
    })
  }

  async getLiveSnapshotReadUrls(user, { attemptId }) {
    if (!attemptId) throw new NotFoundError('Attempt ID required')
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId }
    })
    if (!attempt) {
      throw new NotFoundError(`Attempt ${attemptId} not found`)
    }

    const cameraKey = `live/${attempt.examId}/${attemptId}/camera.webp`
    const screenKey = `live/${attempt.examId}/${attemptId}/screen.webp`

    const [cameraUrl, screenUrl] = await Promise.all([
      mediaService.getReadUrl(cameraKey),
      mediaService.getReadUrl(screenKey)
    ])

    return { cameraUrl, screenUrl }
  }
}

const presignService = new PresignService()

module.exports = {
  presignService,
  PresignService,
  NotFoundError,
  ForbiddenError
}
