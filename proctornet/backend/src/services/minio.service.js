const fs = require('fs')
const path = require('path')

const UPLOAD_DIR = path.join(__dirname, '../../uploads/snapshots')

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

/**
 * Save periodic 10-15s webcam/screen snapshot to MinIO / Local storage
 */
async function storeSnapshot(studentExamId, frameBase64, frameType = 'webcam') {
  try {
    const filename = `${studentExamId}_${frameType}_${Date.now()}.jpg`
    const filePath = path.join(UPLOAD_DIR, filename)
    const base64Data = frameBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    
    fs.writeFileSync(filePath, buffer)
    return `/uploads/snapshots/${filename}`
  } catch (err) {
    console.error('[MinIO Service] Error storing snapshot:', err.message)
    return null
  }
}

/**
 * Save 60-second violation clip evidence
 */
async function storeEvidenceClip(studentExamId, violationType, clipBase64) {
  try {
    const filename = `evidence_${studentExamId}_${violationType}_${Date.now()}.webm`
    const filePath = path.join(UPLOAD_DIR, filename)
    const base64Data = clipBase64.replace(/^data:video\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    
    fs.writeFileSync(filePath, buffer)
    return `/uploads/snapshots/${filename}`
  } catch (err) {
    console.error('[MinIO Service] Error storing evidence clip:', err.message)
    return null
  }
}

module.exports = {
  storeSnapshot,
  storeEvidenceClip
}
