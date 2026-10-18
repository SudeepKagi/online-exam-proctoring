const { mediaService } = require('./media.service')

async function presignUpload(req, res, next) {
  try {
    const { purpose, attemptId, contentType, bytes } = req.body
    const result = await mediaService.generatePresignedUpload({
      purpose,
      attemptId,
      contentType,
      bytes
    })
    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

async function verifyFace(req, res, next) {
  try {
    const { liveFrameKey, attemptId } = req.body
    const studentId = req.user?.id
    const targetAttemptId = attemptId || req.params.attemptId

    const result = await mediaService.verifyLiveFaceAgainstReference(studentId, liveFrameKey, targetAttemptId)
    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

async function getReadUrl(req, res, next) {
  try {
    const { key } = req.query
    const url = await mediaService.getReadUrl(key)
    return res.status(200).json({ key, url })
  } catch (err) {
    next(err)
  }
}

async function uploadVerificationPhoto(req, res, next) {
  try {
    const { imageBase64, category } = req.body
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: { message: 'Authentication required' } })
    }
    const result = await mediaService.uploadVerificationPhoto(userId, { imageBase64, category })
    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

async function serveUserPhoto(req, res, next) {
  try {
    const { userId, type } = req.params
    const photo = await mediaService.getPhotoBytes(userId, type)
    if (!photo || !photo.buffer) {
      return res.status(404).json({ error: { message: 'Photo not found' } })
    }
    res.setHeader('Content-Type', photo.contentType || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return res.send(photo.buffer)
  } catch (err) {
    next(err)
  }
}

function localUploadHandler(req, res) {
  return res.status(200).json({ status: 'ok', message: 'Local upload endpoint accepted' })
}

module.exports = {
  presignUpload,
  verifyFace,
  uploadVerificationPhoto,
  serveUserPhoto,
  getReadUrl,
  localUploadHandler
}
