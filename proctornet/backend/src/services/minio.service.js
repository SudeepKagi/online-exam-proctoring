const fs = require('fs')
const path = require('path')
const s3Service = require('./s3.service')

const UPLOAD_DIR = path.join(__dirname, '../../uploads/snapshots')

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const hasAws = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_S3_BUCKET_NAME)

/**
 * Save periodic 10-15s webcam/screen snapshot to AWS S3 (with local storage fallback)
 */
async function storeSnapshot(studentExamId, frameBase64, frameType = 'webcam') {
  if (hasAws) {
    try {
      const s3Url = await s3Service.storeSnapshot(studentExamId, frameBase64, frameType)
      if (s3Url) return s3Url
    } catch (err) {
      console.warn('[Storage] S3 storeSnapshot failed, using local disk fallback:', err.message)
    }
  }

  // Local disk fallback
  try {
    const filename = `${studentExamId}_${frameType}_${Date.now()}.jpg`
    const filePath = path.join(UPLOAD_DIR, filename)
    const base64Data = frameBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    fs.writeFileSync(filePath, buffer)
    return `/uploads/snapshots/${filename}`
  } catch (err) {
    console.error('[Storage Service] Error storing snapshot locally:', err.message)
    return null
  }
}

/**
 * Save 60-second violation clip evidence to AWS S3 (with local storage fallback)
 */
async function storeEvidenceClip(studentExamId, violationType, clipBase64) {
  if (hasAws) {
    try {
      const s3Url = await s3Service.storeEvidenceClip(studentExamId, violationType, clipBase64)
      if (s3Url) return s3Url
    } catch (err) {
      console.warn('[Storage] S3 storeEvidenceClip failed, using local disk fallback:', err.message)
    }
  }

  // Local disk fallback
  try {
    const filename = `evidence_${studentExamId}_${violationType}_${Date.now()}.webm`
    const filePath = path.join(UPLOAD_DIR, filename)
    const base64Data = clipBase64.replace(/^data:video\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    fs.writeFileSync(filePath, buffer)
    return `/uploads/snapshots/${filename}`
  } catch (err) {
    console.error('[Storage Service] Error storing evidence clip locally:', err.message)
    return null
  }
}

module.exports = {
  storeSnapshot,
  storeEvidenceClip,
}
