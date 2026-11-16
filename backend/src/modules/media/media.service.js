const crypto = require('crypto')
const mediaSql = require('./media.sql')
const { createDirectUploadPolicy, getPresignedReadUrl, putObject } = require('../../infra/s3/s3.client')
const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')

class MediaService {
  constructor() {
    this.region = process.env.AWS_REGION || 'ap-south-1'
    this.bucket = process.env.S3_BUCKET || 'proctornet-storage'
    this.threshold = Number(process.env.FACE_MATCH_THRESHOLD) || 90
  }

  async recordAttemptIdentityResult({ targetAttemptId, studentId, examId, photoBuffer, cleanBase64, result }) {
    try {
      let attempt = null
      if (targetAttemptId) {
        attempt = await prisma.examAttempt.findUnique({ where: { id: targetAttemptId } })
      } else if (examId && studentId) {
        attempt = await prisma.examAttempt.findUnique({
          where: { examId_studentId: { examId, studentId } }
        })
        if (!attempt) {
          attempt = await prisma.examAttempt.create({
            data: {
              examId,
              studentId,
              status: 'NOT_STARTED',
              faceVerified: false
            }
          }).catch(() => null)
        }
      }

      let photoKey = null
      if (attempt && (photoBuffer || cleanBase64)) {
        photoKey = `attempts/${attempt.id}/identity-${Date.now()}.jpg`
        const buffer = photoBuffer || Buffer.from(cleanBase64, 'base64')
        try {
          await putObject(photoKey, buffer, 'image/jpeg')
        } catch (_) {}
      }

      if (attempt) {
        const similarity = result.similarity || 0
        const bucket = result.status === 'MATCH'
          ? (similarity >= 95 ? 'HIGH' : 'MEDIUM')
          : (result.status === 'NO_REFERENCE' ? 'PENDING' : similarity > 0 ? 'LOW' : 'N/A')

        await prisma.examAttempt.update({
          where: { id: attempt.id },
          data: {
            facePhotoKey: photoKey || undefined,
            faceStatus: result.status,
            similarityBucket: bucket,
            faceVerified: Boolean(result.verified),
            faceVerifiedAt: result.verified ? new Date() : null
          }
        }).catch(() => {})

        if (result.status === 'NO_REFERENCE') {
          try {
            const { socketEmitter } = require('../../infra/websocket/emitter')
            socketEmitter.emitToInvigilators(attempt.examId, 'identity:pending_approval', {
              attemptId: attempt.id,
              studentId,
              status: result.status,
              reason: result.reason,
              photoKey
            })
          } catch (_) {}
        }
      }
    } catch (_) {}
    return result
  }

  async generatePresignedUpload({ purpose, attemptId, contentType = 'image/jpeg', bytes = 1048576, metadata = {} }) {
    const uuid = crypto.randomUUID()
    let folder = 'evidence'
    if (purpose === 'LIVE_FRAME') folder = 'frames'
    else if (purpose === 'REFERENCE_PHOTO') folder = 'reference-photos'
    else if (purpose === 'ID_CARD') folder = 'id-cards'
    const ext = contentType.includes('png') ? 'png' : 'jpg'
    
    let key
    if (purpose === 'VIOLATION_SCREENSHOT' || purpose === 'SCREENSHOT') {
      const examId = metadata?.examId || 'general'
      const eventType = metadata?.eventType || 'event'
      key = `evidence/screenshots/${examId}/${attemptId || 'attempts'}/${Date.now()}-${eventType}.${ext}`
    } else {
      key = `${folder}/${attemptId || 'users'}/${Date.now()}-${uuid}.${ext}`
    }

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
      if (process.env.NODE_ENV === 'production') {
        logger.error({ error: err.message, key }, 'Failed to generate direct upload policy in production')
        throw err
      }
      logger.warn({ error: err.message, key }, 'Failed to generate direct upload policy, returning mock for offline dev')
      return {
        key,
        putUrl: `/api/v1/media/upload-mock?key=${encodeURIComponent(key)}`,
        postUrl: `/api/v1/media/upload-mock?key=${encodeURIComponent(key)}`,
        fields: { key }
      }
    }
  }

  async verifyLiveFaceAgainstReference(studentIdOrOpts, liveFrameKey = null, attemptId = null) {
    let studentId
    let targetAttemptId
    let targetLiveKey
    let imageBase64
    let examId

    if (studentIdOrOpts && typeof studentIdOrOpts === 'object') {
      studentId = studentIdOrOpts.studentId
      targetAttemptId = studentIdOrOpts.attemptId
      targetLiveKey = studentIdOrOpts.liveFrameKey
      imageBase64 = studentIdOrOpts.imageBase64 || studentIdOrOpts.image
      examId = studentIdOrOpts.examId
    } else {
      studentId = studentIdOrOpts
      targetAttemptId = attemptId
      targetLiveKey = liveFrameKey
    }

    let liveBuffer = null
    let cleanBase64 = ''
    if (imageBase64 && typeof imageBase64 === 'string') {
      cleanBase64 = imageBase64.includes(';base64,') ? imageBase64.split(';base64,')[1] : imageBase64
      liveBuffer = Buffer.from(cleanBase64, 'base64')
    }

    let studentData = null
    if (studentId) {
      studentData = await mediaSql.getUserReferencePhotoKey(studentId)
    } else if (targetAttemptId) {
      studentData = await mediaSql.getStudentReferencePhotoByAttempt(targetAttemptId)
    }

    const referencePhotoKey = studentData?.referencePhotoKey
    const dataUrl = studentData?.profileMetadata?.facePhotoDataUrl || (referencePhotoKey?.startsWith('data:') ? referencePhotoKey : null)

    // Phase 2 A.4: If no reference photo exists, reject with clear message
    if (!referencePhotoKey && !dataUrl) {
      return this.recordAttemptIdentityResult({
        targetAttemptId, studentId, examId, photoBuffer: liveBuffer, cleanBase64,
        result: {
          verified: false,
          similarity: 0,
          decision: 'FAIL',
          status: 'NO_REFERENCE',
          reason: 'No reference photo on file. Contact your administrator.'
        }
      })
    }

    let referencePhotoBuffer = null
    if (dataUrl?.includes(';base64,')) {
      referencePhotoBuffer = Buffer.from(dataUrl.split(';base64,')[1], 'base64')
    }

    if (!liveBuffer && !targetLiveKey) {
      return this.recordAttemptIdentityResult({
        targetAttemptId, studentId, examId, photoBuffer: null, cleanBase64,
        result: {
          verified: false,
          similarity: 0,
          decision: 'FAIL',
          status: 'NO_FACE',
          reason: 'No face photo provided for verification. Please capture a photo.'
        }
      })
    }

    // Phase 2 A.3 Dev/Test fallback driver & mock simulation
    const isTestOrDev = process.env.NODE_ENV !== 'production' || process.env.FACE_DRIVER === 'off' || process.env.FACE_DRIVER === 'test'
    if (isTestOrDev) {
      const decodedText = liveBuffer ? liveBuffer.toString('utf8').toLowerCase() : ''
      const probeStr = `${cleanBase64} ${targetLiveKey || ''} ${decodedText}`.toLowerCase()
      if (probeStr.includes('no-match')) {
        return this.recordAttemptIdentityResult({
          targetAttemptId, studentId, examId, photoBuffer: liveBuffer, cleanBase64,
          result: {
            verified: false,
            similarity: 42.0,
            decision: 'FAIL',
            status: 'NO_MATCH',
            reason: 'Face did not match institutional reference photo. Please retake.'
          }
        })
      }
      if (probeStr.includes('no-face')) {
        return this.recordAttemptIdentityResult({
          targetAttemptId, studentId, examId, photoBuffer: liveBuffer, cleanBase64,
          result: {
            verified: false,
            similarity: 0,
            decision: 'FAIL',
            status: 'NO_FACE',
            reason: 'No face detected in the photo. Please ensure your face is well-lit and clearly visible.'
          }
        })
      }
      if (probeStr.includes('multiple-faces')) {
        return this.recordAttemptIdentityResult({
          targetAttemptId, studentId, examId, photoBuffer: liveBuffer, cleanBase64,
          result: {
            verified: false,
            similarity: 0,
            decision: 'FAIL',
            status: 'MULTIPLE_FACES',
            reason: 'Multiple faces detected in the photo. Please ensure only the candidate is visible.'
          }
        })
      }
      if (probeStr.includes('low-quality')) {
        return this.recordAttemptIdentityResult({
          targetAttemptId, studentId, examId, photoBuffer: liveBuffer, cleanBase64,
          result: {
            verified: false,
            similarity: 0,
            decision: 'FAIL',
            status: 'LOW_QUALITY',
            reason: 'Photo quality is too low or blurry. Please retake in good lighting.'
          }
        })
      }
      if (probeStr.includes('service-error')) {
        return this.recordAttemptIdentityResult({
          targetAttemptId, studentId, examId, photoBuffer: liveBuffer, cleanBase64,
          result: {
            verified: false,
            similarity: 0,
            decision: 'FAIL',
            status: 'SERVICE_ERROR',
            reason: 'Face verification service is currently unavailable. Please retry or contact support.'
          }
        })
      }

      return this.recordAttemptIdentityResult({
        targetAttemptId, studentId, examId, photoBuffer: liveBuffer, cleanBase64,
        result: {
          verified: true,
          similarity: 96.5,
          decision: 'PASS',
          status: 'MATCH',
          confidence: 99.0
        }
      })
    }

    try {
      const { RekognitionClient, CompareFacesCommand } = require('@aws-sdk/client-rekognition')
      const client = new RekognitionClient({ region: this.region })

      const sourceImage = referencePhotoBuffer
        ? { Bytes: referencePhotoBuffer }
        : { S3Object: { Bucket: this.bucket, Name: referencePhotoKey } }

      const targetImage = liveBuffer
        ? { Bytes: liveBuffer }
        : { S3Object: { Bucket: this.bucket, Name: targetLiveKey } }

      const command = new CompareFacesCommand({
        SourceImage: sourceImage,
        TargetImage: targetImage,
        SimilarityThreshold: this.threshold
      })

      const response = await client.send(command)
      const matches = response.FaceMatches || []
      const unmatched = response.UnmatchedFaces || []

      if (unmatched.length > 1 || (matches.length + unmatched.length > 1)) {
        return this.recordAttemptIdentityResult({
          targetAttemptId, studentId, examId, photoBuffer: liveBuffer, cleanBase64,
          result: {
            verified: false,
            similarity: matches[0]?.Similarity || 0,
            decision: 'FAIL',
            status: 'MULTIPLE_FACES',
            reason: 'Multiple faces detected in the photo. Please ensure only the candidate is visible.'
          }
        })
      }

      if (matches.length > 0 && matches[0].Similarity >= this.threshold) {
        return this.recordAttemptIdentityResult({
          targetAttemptId, studentId, examId, photoBuffer: liveBuffer, cleanBase64,
          result: {
            verified: true,
            similarity: matches[0].Similarity,
            decision: 'PASS',
            status: 'MATCH',
            confidence: matches[0].Face?.Confidence || 99
          }
        })
      }

      return this.recordAttemptIdentityResult({
        targetAttemptId, studentId, examId, photoBuffer: liveBuffer, cleanBase64,
        result: {
          verified: false,
          similarity: matches[0]?.Similarity || 0,
          decision: 'FAIL',
          status: 'NO_MATCH',
          reason: 'Face did not match institutional reference photo. Please retake.'
        }
      })
    } catch (err) {
      logger.warn({ error: err.message, referencePhotoKey, targetLiveKey }, 'Rekognition CompareFaces failed')
      if (err.name === 'InvalidParameterException' || String(err.message).toLowerCase().includes('no face')) {
        return this.recordAttemptIdentityResult({
          targetAttemptId, studentId, examId, photoBuffer: liveBuffer, cleanBase64,
          result: {
            verified: false,
            similarity: 0,
            decision: 'FAIL',
            status: 'NO_FACE',
            reason: 'No face detected in the photo. Please ensure your face is well-lit and clearly visible.'
          }
        })
      }

      return this.recordAttemptIdentityResult({
        targetAttemptId, studentId, examId, photoBuffer: liveBuffer, cleanBase64,
        result: {
          verified: false,
          similarity: 0,
          decision: 'FAIL',
          status: 'SERVICE_ERROR',
          reason: `Face verification service unavailable: ${err.message}`
        }
      })
    }
  }

  async uploadVerificationPhoto(userId, { imageBase64, category }) {
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      const err = new Error('Image data is required')
      err.status = 400
      throw err
    }
    const cat = String(category || 'FACE').toUpperCase()
    if (cat !== 'FACE' && cat !== 'ID_CARD') {
      const err = new Error('Invalid category. Must be FACE or ID_CARD')
      err.status = 400
      throw err
    }

    let contentType = 'image/jpeg'
    let base64Data
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,')
      contentType = parts[0].replace(/^data:/, '') || 'image/jpeg'
      base64Data = parts[1]
    } else {
      base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    }

    const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:${contentType};base64,${base64Data}`
    const buffer = Buffer.from(base64Data, 'base64')
    if (buffer.length === 0) {
      const err = new Error('Invalid image buffer')
      err.status = 400
      throw err
    }

    const ext = contentType.includes('png') ? 'png' : 'jpg'
    const uuid = crypto.randomUUID()
    const folder = cat === 'FACE' ? 'reference-photos' : 'id-cards'
    const key = `${folder}/${userId}/${Date.now()}-${uuid}.${ext}`

    let s3Uploaded = false
    try {
      await putObject(key, buffer, contentType)
      s3Uploaded = true
    } catch (err) {
      logger.warn({ error: err.message, key }, 'S3 putObject failed, storing data URI in fallback mode')
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileMetadata: true } })
    const existingMeta = (user?.profileMetadata && typeof user.profileMetadata === 'object') ? user.profileMetadata : {}
    const updatedMeta = { ...existingMeta }
    if (cat === 'FACE') updatedMeta.facePhotoDataUrl = dataUrl
    else updatedMeta.idCardPhotoDataUrl = dataUrl

    const updateData = { profileMetadata: updatedMeta }
    if (cat === 'FACE') updateData.referencePhotoKey = s3Uploaded ? key : dataUrl
    else updateData.idCardPhotoKey = s3Uploaded ? key : dataUrl

    await prisma.user.update({
      where: { id: userId },
      data: updateData
    })

    return {
      success: true,
      category: cat,
      key: s3Uploaded ? key : dataUrl,
      url: dataUrl
    }
  }

  async getPhotoBytes(userId, type) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referencePhotoKey: true, idCardPhotoKey: true, profileMetadata: true }
    })
    if (!user) return null

    const isFace = type === 'face' || type === 'reference'
    const dataUrl = isFace
      ? (user.profileMetadata?.facePhotoDataUrl || (user.referencePhotoKey?.startsWith('data:') ? user.referencePhotoKey : null))
      : (user.profileMetadata?.idCardPhotoDataUrl || (user.idCardPhotoKey?.startsWith('data:') ? user.idCardPhotoKey : null))

    if (dataUrl?.includes(';base64,')) {
      const parts = dataUrl.split(';base64,')
      const contentType = parts[0].replace(/^data:/, '') || 'image/jpeg'
      const buffer = Buffer.from(parts[1] || '', 'base64')
      return { buffer, contentType }
    }

    const s3Key = isFace ? user.referencePhotoKey : user.idCardPhotoKey
    if (s3Key) {
      const { getObjectBuffer } = require('../../infra/s3/s3.client')
      try {
        const buffer = await getObjectBuffer(s3Key)
        if (buffer) return { buffer, contentType: s3Key.endsWith('.png') ? 'image/png' : 'image/jpeg' }
      } catch (_) {}
    }
    return null
  }

  async getReadUrl(key) {
    return getPresignedReadUrl(key, 600)
  }
}

const mediaService = new MediaService()
module.exports = { mediaService, MediaService }
