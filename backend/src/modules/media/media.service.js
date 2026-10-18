const crypto = require('crypto')
const mediaSql = require('./media.sql')
const { createDirectUploadPolicy, getPresignedReadUrl } = require('../../infra/s3/s3.client')
const { logger } = require('../../shared/logging')

class MediaService {
  constructor() {
    this.region = process.env.AWS_REGION || 'ap-south-1'
    this.bucket = process.env.S3_BUCKET || 'proctornet-storage'
    this.threshold = Number(process.env.FACE_MATCH_THRESHOLD) || 80
  }

  async generatePresignedUpload({ purpose, attemptId, contentType = 'image/jpeg', bytes = 1048576 }) {
    const uuid = crypto.randomUUID()
    let folder = 'evidence'
    if (purpose === 'LIVE_FRAME') folder = 'frames'
    else if (purpose === 'REFERENCE_PHOTO') folder = 'reference-photos'
    else if (purpose === 'ID_CARD') folder = 'id-cards'
    const ext = contentType.includes('png') ? 'png' : 'jpg'
    const key = `${folder}/${attemptId || 'users'}/${Date.now()}-${uuid}.${ext}`

    try {
      const policy = await createDirectUploadPolicy({
        key,
        contentType,
        maxSizeBytes: Math.min(bytes * 2, 10 * 1024 * 1024),
        expiresIn: 300
      })

      return {
        key,
        putUrl: policy.putUrl || null,
        postUrl: policy.url || policy.postUrl || null,
        fields: policy.fields || {}
      }
    } catch (err) {
      logger.warn({ error: err.message, key }, 'Failed to generate direct upload policy, returning mock for offline dev')
      return {
        key,
        putUrl: `/api/v1/media/upload-mock?key=${encodeURIComponent(key)}`,
        postUrl: `/api/v1/media/upload-mock?key=${encodeURIComponent(key)}`,
        fields: { key }
      }
    }
  }

  async verifyLiveFaceAgainstReference(studentId, liveFrameKey, attemptId = null) {
    let referencePhotoKey = null
    if (studentId) {
      referencePhotoKey = await mediaSql.getUserReferencePhotoKey(studentId)
    } else if (attemptId) {
      const studentData = await mediaSql.getStudentReferencePhotoByAttempt(attemptId)
      referencePhotoKey = studentData?.referencePhotoS3Key
    }

    // If no reference photo exists yet, grant verification for pre-check flow
    if (!referencePhotoKey) {
      return {
        verified: true,
        similarity: null,
        decision: 'PASS',
        reason: 'Initial session reference photo established'
      }
    }

    // AWS Rekognition CompareFaces execution
    try {
      const { RekognitionClient, CompareFacesCommand } = require('@aws-sdk/client-rekognition')
      const client = new RekognitionClient({ region: this.region })

      const command = new CompareFacesCommand({
        SourceImage: {
          S3Object: { Bucket: this.bucket, Name: referencePhotoKey }
        },
        TargetImage: {
          S3Object: { Bucket: this.bucket, Name: liveFrameKey }
        },
        SimilarityThreshold: this.threshold
      })

      const response = await client.send(command)
      const matches = response.FaceMatches || []

      if (matches.length > 0 && matches[0].Similarity >= this.threshold) {
        return {
          verified: true,
          similarity: matches[0].Similarity,
          decision: 'PASS',
          confidence: matches[0].Face?.Confidence || 99
        }
      }

      return {
        verified: false,
        similarity: matches[0]?.Similarity || 0,
        decision: 'FAIL',
        reason: 'Face match similarity below institutional threshold'
      }
    } catch (err) {
      logger.warn({ error: err.message, referencePhotoKey, liveFrameKey }, 'Rekognition compare failed; checking dev fallback')
      // Fallback for dev / offline test environment without live AWS credentials
      if (process.env.NODE_ENV !== 'production' || process.env.FACE_DRIVER === 'off') {
        return {
          verified: true,
          similarity: null,
          decision: 'PASS',
          reason: 'Development mode fallback verification'
        }
      }

      return {
        verified: false,
        similarity: 0,
        decision: 'FAIL',
        reason: `Face verification service unavailable: ${err.message}`
      }
    }
  }

  async getReadUrl(key) {
    return getPresignedReadUrl(key, 600)
  }
}

const mediaService = new MediaService()
module.exports = { mediaService, MediaService }
