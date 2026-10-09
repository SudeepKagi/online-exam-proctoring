const crypto = require('crypto')
const { getFaceVerifier, DECISIONS, LIVENESS_ACTIONS } = require('./faceVerifier')
const { prisma } = require('../../infra/postgres/client')
const { redisClient } = require('../../infra/redis/client')
const { logger } = require('../../shared/logging')
const { ValidationError, NotFoundError } = require('../../shared/errors')

class FaceVerificationService {
  constructor(verifier = null) {
    this._customVerifier = verifier
  }

  getVerifier() {
    return this._customVerifier || getFaceVerifier()
  }

  /**
   * Env-configurable thresholds with hard safety bounds (ADR-013)
   */
  getThresholds() {
    const rawPass = parseInt(process.env.FACE_VERIFY_THRESHOLD_PASS || '95', 10)
    const rawReview = parseInt(process.env.FACE_VERIFY_THRESHOLD_REVIEW || '85', 10)

    const pass = Math.max(80, Math.min(99, isNaN(rawPass) ? 95 : rawPass))
    const review = Math.max(60, Math.min(pass - 1, isNaN(rawReview) ? 85 : rawReview))

    return { pass, review }
  }

  /**
   * Validate enrollment photo quality gates (Server-side)
   * Exactly 1 face, >= 20% frame height, brightness/sharpness >= 40, pose <= 20 deg, eyes open, not occluded
   */
  async validateEnrollmentQuality(imageRef) {
    const verifier = this.getVerifier()
    const detectResult = await verifier.detect(imageRef)

    const reasons = []

    if (detectResult.faceCount === 0) {
      reasons.push('No face detected in photo. Please ensure your face is clearly visible in the camera frame.')
    } else if (detectResult.faceCount > 1) {
      reasons.push('Multiple faces detected. Please ensure only you are present in the photo.')
    } else {
      // Exactly 1 face checks
      const bbox = detectResult.boundingBox || {}
      if ((bbox.height || 0) < 0.20) {
        reasons.push('Face is too far from camera. Please move closer to fill at least 20% of the frame.')
      }

      const quality = detectResult.quality || {}
      if ((quality.brightness || 0) < 40) {
        reasons.push('Lighting is too dark. Please ensure your face is well illuminated.')
      }
      if ((quality.sharpness || 0) < 40) {
        reasons.push('Image is blurry. Please hold steady and ensure your camera is clean.')
      }

      const pose = detectResult.pose || {}
      if (Math.abs(pose.yaw || 0) > 20 || Math.abs(pose.pitch || 0) > 20) {
        reasons.push('Please look directly at the camera without tilting or turning your head.')
      }

      if (!detectResult.eyesOpen) {
        reasons.push('Please keep your eyes open and look directly into the camera.')
      }

      if (detectResult.occluded) {
        reasons.push('Face appears partially covered. Please remove any sunglasses, hats, or face coverings.')
      }
    }

    const passed = reasons.length === 0
    return {
      passed,
      valid: passed,
      reasons,
      reason: reasons[0] || null,
      details: detectResult
    }
  }

  /**
   * Compare enrollment photo with ID card photo as an assistive signal for admin approval queue
   */
  async compareEnrollmentWithIdCard(enrollmentRef, idCardRef) {
    const verifier = this.getVerifier()
    try {
      const compareResult = await verifier.compare(enrollmentRef, idCardRef)
      return {
        similarity: compareResult.similarity ?? 0.0,
        faceConfidence: compareResult.faceConfidence ?? 0.0,
        requestId: compareResult.requestId || null,
        provider: compareResult.provider || 'rekognition',
        modelVersion: compareResult.modelVersion || 'aws-rekognition-v1'
      }
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed comparing enrollment photo with ID card; recording 0 signal')
      return {
        similarity: 0.0,
        faceConfidence: 0.0,
        requestId: null,
        provider: 'error',
        modelVersion: 'none',
        error: err.message
      }
    }
  }

  /**
   * Issue random liveness challenge for 3-frame burst ("live check")
   */
  async generateLivenessChallenge(attemptId) {
    const actions = [
      LIVENESS_ACTIONS.TURN_LEFT,
      LIVENESS_ACTIONS.TURN_RIGHT,
      LIVENESS_ACTIONS.LOOK_UP,
      LIVENESS_ACTIONS.LOOK_DOWN
    ]

    const action = actions[Math.floor(Math.random() * actions.length)]
    const challengeId = crypto.randomUUID()

    const instructionsMap = {
      [LIVENESS_ACTIONS.TURN_LEFT]: 'Please slowly turn your head to your left',
      [LIVENESS_ACTIONS.TURN_RIGHT]: 'Please slowly turn your head to your right',
      [LIVENESS_ACTIONS.LOOK_UP]: 'Please look up slightly toward the ceiling',
      [LIVENESS_ACTIONS.LOOK_DOWN]: 'Please look down slightly toward your desk'
    }

    const challenge = {
      challengeId,
      attemptId,
      action,
      instruction: instructionsMap[action],
      createdAt: Date.now()
    }

    try {
      await redisClient.set(`pn:liveness:${challengeId}`, JSON.stringify(challenge), 'EX', 120)
    } catch (err) {
      logger.warn({ error: err.message }, 'Could not persist liveness challenge in Redis')
    }

    return {
      challengeId,
      action,
      instruction: instructionsMap[action],
      expiresInSeconds: 120
    }
  }

  /**
   * Verify liveness challenge using 3-frame burst pose change
   */
  async verifyLiveness(challengeId, burstKeys) {
    if (!Array.isArray(burstKeys) || burstKeys.length < 2) {
      return {
        passed: false,
        reason: 'Live check requires at least a 2-frame motion burst.'
      }
    }

    let challenge = null
    try {
      const raw = await redisClient.get(`pn:liveness:${challengeId}`)
      if (raw) challenge = JSON.parse(raw)
    } catch (err) {
      logger.warn({ error: err.message }, 'Error fetching liveness challenge from Redis')
    }

    if (!challenge) {
      return {
        passed: false,
        reason: 'Live check challenge expired or invalid. Please request a new challenge.'
      }
    }

    const verifier = this.getVerifier()
    const detections = []

    for (const key of burstKeys) {
      try {
        const d = await verifier.detect(key)
        detections.push(d)
      } catch (err) {
        logger.warn({ error: err.message, key }, 'Failed detecting face in liveness frame')
      }
    }

    if (detections.length < 2 || detections.some(d => d.faceCount !== 1)) {
      return {
        passed: false,
        reason: 'Live check could not detect a single clear face across motion frames.'
      }
    }

    const basePose = detections[0].pose || { yaw: 0, pitch: 0 }
    let maxDelta = 0
    let passed = false

    const action = challenge.action

    for (let i = 1; i < detections.length; i++) {
      const currPose = detections[i].pose || { yaw: 0, pitch: 0 }
      const yawDelta = currPose.yaw - basePose.yaw
      const pitchDelta = currPose.pitch - basePose.pitch

      if (action === LIVENESS_ACTIONS.TURN_LEFT && (yawDelta < -10 || currPose.yaw < -10)) {
        passed = true
        maxDelta = Math.abs(yawDelta)
      } else if (action === LIVENESS_ACTIONS.TURN_RIGHT && (yawDelta > 10 || currPose.yaw > 10)) {
        passed = true
        maxDelta = Math.abs(yawDelta)
      } else if (action === LIVENESS_ACTIONS.LOOK_UP && (pitchDelta < -8 || currPose.pitch < -8)) {
        passed = true
        maxDelta = Math.abs(pitchDelta)
      } else if (action === LIVENESS_ACTIONS.LOOK_DOWN && (pitchDelta > 8 || currPose.pitch > 8)) {
        passed = true
        maxDelta = Math.abs(pitchDelta)
      }
    }

    // One-time challenge consumption
    try {
      await redisClient.del(`pn:liveness:${challengeId}`)
    } catch (_) {
      // ignore Redis cache cleanup error
    }

    if (!passed) {
      return {
        passed: false,
        reason: 'Head motion did not match requested direction. Please follow the on-screen prompt.'
      }
    }

    return {
      passed: true,
      action: challenge.action,
      deltaDegrees: maxDelta
    }
  }

  /**
   * Pre-exam verification: runs detect + compare with multi-tier decision logic
   * PASS >= T_pass | REVIEW T_review <= s < T_pass | FAIL < T_review | ERROR -> REVIEW (fail-closed)
   */
  async verifyPreExam({ attemptId, studentId, liveFrameKey, challengeId = null, burstKeys = null }) {
    const thresholds = this.getThresholds()

    // 1. Fetch student enrolled face photo key
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, facePhotoKey: true, approvalStatus: true }
    })

    if (!student || !student.facePhotoKey) {
      return {
        decision: DECISIONS.FAIL,
        verified: false,
        pendingReview: false,
        message: 'No enrolled biometric profile found. Please complete identity enrollment before taking the exam.'
      }
    }

    // 2. Optional liveness check verification
    if (challengeId && burstKeys) {
      const livenessResult = await this.verifyLiveness(challengeId, burstKeys)
      if (!livenessResult.passed) {
        return {
          decision: DECISIONS.FAIL,
          verified: false,
          pendingReview: false,
          message: livenessResult.reason || 'Live check failed. Please position your face and follow the motion prompt.'
        }
      }
    }

    const verifier = this.getVerifier()

    // 3. Detect faces in live frame for quality & single-face invariant
    let detectResult
    try {
      detectResult = await verifier.detect(liveFrameKey)
    } catch (err) {
      logger.error({ error: err.message, attemptId }, 'Verifier error on detect live frame; failing closed to REVIEW')
      await this._persistVerificationRecord({
        attemptId,
        kind: 'PRE_EXAM',
        provider: 'error',
        requestId: null,
        similarity: 0.0,
        decision: DECISIONS.REVIEW,
        thresholdsUsed: thresholds,
        modelVersion: 'none',
        evidenceKeys: [liveFrameKey],
        errorCode: 'VERIFIER_UNAVAILABLE'
      })

      return {
        decision: DECISIONS.REVIEW,
        verified: false,
        pendingReview: true,
        message: 'We could not confirm your identity — waiting for invigilator verification.',
        errorCode: 'VERIFIER_UNAVAILABLE'
      }
    }

    if (detectResult.faceCount === 0) {
      return {
        decision: DECISIONS.FAIL,
        verified: false,
        pendingReview: false,
        message: 'No face detected in the live camera frame. Please position yourself clearly in front of the camera.'
      }
    }

    if (detectResult.faceCount > 1) {
      return {
        decision: DECISIONS.FAIL,
        verified: false,
        pendingReview: false,
        message: 'Multiple faces detected in the live camera frame. Only the registered student may be present.'
      }
    }

    if (detectResult.occluded) {
      return {
        decision: DECISIONS.FAIL,
        verified: false,
        pendingReview: false,
        message: 'Your face appears occluded. Please remove any sunglasses, hats, or face coverings and retry.'
      }
    }

    // 4. Compare live frame with reference enrollment photo
    let compareResult
    try {
      compareResult = await verifier.compare(student.facePhotoKey, liveFrameKey)
    } catch (err) {
      logger.error({ error: err.message, attemptId }, 'Verifier error on compare; failing closed to REVIEW')
      await this._persistVerificationRecord({
        attemptId,
        kind: 'PRE_EXAM',
        provider: 'error',
        requestId: null,
        similarity: 0.0,
        decision: DECISIONS.REVIEW,
        thresholdsUsed: thresholds,
        modelVersion: 'none',
        evidenceKeys: [liveFrameKey],
        errorCode: 'VERIFIER_UNAVAILABLE'
      })

      return {
        decision: DECISIONS.REVIEW,
        verified: false,
        pendingReview: true,
        message: 'We could not confirm your identity — waiting for invigilator verification.',
        errorCode: 'VERIFIER_UNAVAILABLE'
      }
    }

    // 5. Apply multi-tier decision rules
    const similarity = compareResult.similarity ?? 0.0
    let decision
    let message

    if (similarity >= thresholds.pass) {
      decision = DECISIONS.PASS
      message = 'Identity verified successfully.'
    } else if (similarity >= thresholds.review) {
      decision = DECISIONS.REVIEW
      message = "We couldn't confirm your identity — waiting for invigilator verification."
    } else {
      decision = DECISIONS.FAIL
      message = "We couldn't confirm your identity — retry or call the invigilator."
    }

    // 6. Persist verification record
    await this._persistVerificationRecord({
      attemptId,
      kind: 'PRE_EXAM',
      provider: compareResult.provider || 'rekognition',
      requestId: compareResult.requestId || null,
      similarity,
      decision,
      thresholdsUsed: thresholds,
      modelVersion: compareResult.modelVersion || 'aws-rekognition-v1',
      evidenceKeys: [liveFrameKey]
    })

    return {
      decision,
      verified: decision === DECISIONS.PASS,
      pendingReview: decision === DECISIONS.REVIEW,
      message
    }
  }

  /**
   * Periodic re-verification during active exam
   * Requires two consecutive mismatches before raising IDENTITY_MISMATCH violation
   */
  async verifyPeriodic({ attemptId, studentId, frameKey, examId = null }) {
    const thresholds = this.getThresholds()

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, facePhotoKey: true }
    })

    if (!student || !student.facePhotoKey) {
      logger.warn({ studentId }, 'Student facePhotoKey missing for periodic reverification')
      return { matched: false, violationRaised: false }
    }

    const verifier = this.getVerifier()
    let similarity

    try {
      const compareResult = await verifier.compare(student.facePhotoKey, frameKey)
      similarity = compareResult.similarity ?? 0.0
    } catch (err) {
      logger.warn({ error: err.message, attemptId }, 'Periodic reverification compare failed')
      return { matched: false, error: err.message, violationRaised: false }
    }

    const mismatchKey = `pn:reverify:mismatches:${attemptId}`
    let consecutiveMismatches = 0

    if (similarity < thresholds.review) {
      // Mismatch
      try {
        consecutiveMismatches = await redisClient.incr(mismatchKey)
        await redisClient.expire(mismatchKey, 3600)
      } catch (err) {
        logger.warn({ error: err.message }, 'Failed updating mismatch counter in Redis')
      }

      logger.warn(
        { attemptId, studentId, similarity, consecutiveMismatches, thresholds },
        'Periodic face reverification mismatch observed'
      )

      // Only raise violation after TWO consecutive mismatches to suppress false alarms
      if (consecutiveMismatches >= 2) {
        logger.error(
          { attemptId, studentId, consecutiveMismatches },
          'Two consecutive face reverification mismatches! Raising IDENTITY_MISMATCH violation'
        )

        await prisma.violationEvent.create({
          data: {
            attemptId,
            eventType: 'IDENTITY_MISMATCH',
            severity: 'HIGH',
            evidenceKey: frameKey,
            evidenceStatus: 'UPLOADED',
            source: 'AI_REVERIFY',
            metadata: {
              similarity,
              consecutiveMismatches,
              thresholdsUsed: thresholds
            }
          }
        })

        // Reset counter after raising violation
        try {
          await redisClient.del(mismatchKey)
        } catch (_) {
          // ignore Redis cache cleanup error
        }

        return { matched: false, violationRaised: true }
      }

      return { matched: false, violationRaised: false }
    } else {
      // Match restored: reset consecutive mismatch counter
      try {
        await redisClient.del(mismatchKey)
      } catch (_) {
        // ignore Redis cache cleanup error
      }

      return { matched: true, violationRaised: false }
    }
  }

  /**
   * Explicit audited invigilator/admin override
   */
  async overrideVerification({ attemptId, operatorId, operatorRole, decision, reason }) {
    if (!['PASS', 'FAIL'].includes(decision)) {
      throw new ValidationError("Override decision must be 'PASS' or 'FAIL'")
    }
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError('A detailed reason is required for identity verification override')
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId }
    })

    if (!attempt) {
      throw new NotFoundError('Attempt not found')
    }

    const overrideRecord = await prisma.identityVerification.create({
      data: {
        id: crypto.randomUUID(),
        attemptId,
        kind: 'OVERRIDE',
        provider: `operator:${operatorRole.toLowerCase()}`,
        requestId: operatorId,
        similarity: decision === 'PASS' ? 100.0 : 0.0,
        decision,
        thresholdsUsed: { override: true, operatorId, operatorRole, reason },
        modelVersion: 'manual-override',
        status: decision === 'PASS' ? 'VERIFIED' : 'REJECTED'
      }
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: operatorId,
        role: operatorRole.toUpperCase(),
        action: 'IDENTITY_OVERRIDE',
        resourceType: 'EXAM_ATTEMPT',
        resourceId: attemptId,
        details: { decision, reason }
      }
    })

    // Emit identity:decision to attempt room
    try {
      const { socketEmitter } = require('../../infra/websocket/emitter')
      socketEmitter.emitToAttempt(attemptId, 'identity:decision', {
        attemptId,
        decision,
        verified: decision === 'PASS',
        reason
      })
    } catch (_) {}
    try {
      const { io } = require('../../app')
      if (io) {
        io.to(`attempt:${attemptId}`).emit('identity:decision', {
          attemptId,
          decision,
          verified: decision === 'PASS',
          reason
        })
      }
    } catch (_) {}

    return overrideRecord
  }

  async _persistVerificationRecord({
    attemptId,
    kind,
    provider,
    requestId,
    similarity,
    decision,
    thresholdsUsed,
    modelVersion,
    evidenceKeys,
    errorCode = null
  }) {
    try {
      await prisma.identityVerification.create({
        data: {
          id: crypto.randomUUID(),
          attemptId,
          kind: kind || 'PRE_EXAM',
          provider: provider || 'rekognition',
          requestId: requestId || null,
          similarity: typeof similarity === 'number' ? similarity : 0.0,
          decision: decision || DECISIONS.PASS,
          thresholdsUsed: { ...thresholdsUsed, errorCode },
          modelVersion: modelVersion || 'aws-rekognition-v1',
          evidenceKeys: evidenceKeys || [],
          status: decision === DECISIONS.PASS ? 'VERIFIED' : (decision === DECISIONS.REVIEW ? 'PENDING' : 'REJECTED'),
          liveFaceMatchScore: typeof similarity === 'number' ? similarity : 0.0,
          verifiedAt: new Date()
        }
      })
    } catch (err) {
      logger.error({ error: err.message, attemptId }, 'Failed persisting identity_verifications record')
    }
  }
}

const faceVerificationService = new FaceVerificationService()

module.exports = {
  FaceVerificationService,
  faceVerificationService,
  DECISIONS
}
