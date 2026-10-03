const { PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { s3Client } = require('../../services/s3.service')
const crypto = require('crypto')

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'proctornet-evidence-storage'

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/webm',
  'video/mp4',
  'application/pdf'
]

class PresignService {
  /**
   * Generate an authorized S3 PUT presigned URL for direct client upload (ADR-011)
   */
  async generateUploadPresignedUrl(attemptId, studentId, contentType = 'image/jpeg', purpose = 'evidence') {
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new Error(`Unsupported content type: ${contentType}`)
    }

    const extMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'video/webm': '.webm',
      'video/mp4': '.mp4',
      'application/pdf': '.pdf'
    }
    const ext = extMap[contentType] || '.jpg'
    const randomHex = crypto.randomBytes(8).toString('hex')
    const key = `evidence/${attemptId}/${purpose}_${Date.now()}_${randomHex}${ext}`

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      Metadata: {
        attemptId,
        studentId,
        purpose
      }
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }) // 15 min TTL

    return {
      uploadUrl,
      key,
      contentType,
      expiresIn: 900
    }
  }
}

module.exports = {
  PresignService,
  presignService: new PresignService()
}
