const axios = require('axios')
const comprefaceService = require('./compreface.service')

/**
 * Verify live webcam frame against registered student face profile
 * Always fails closed if no match or error occurs.
 */
async function verifyFaceBiometrics({ studentId, examId, liveFrame }) {
  if (!liveFrame) {
    return {
      verified: false,
      matchScore: 0,
      reason: 'Missing live frame for verification'
    }
  }

  let student = null
  if (studentId && global.prisma?.student) {
    try {
      student = await global.prisma.student.findUnique({
        where: { id: studentId },
        select: { usn: true, facePhotoUrl: true, faceSubjectId: true }
      })
    } catch (_err) {
      // Prisma error, will fail closed below
    }
  }

  let matchResult = null
  const subjectId = student?.faceSubjectId || student?.usn

  // 1. Try CompreFace service first
  if (subjectId) {
    try {
      matchResult = await comprefaceService.recognizeFace(liveFrame, subjectId)
    } catch (cfErr) {
      console.warn('[verifyFace CompreFace Warning]', cfErr.message)
    }
  }

  // 2. Fallback to Python AI Microservice real OpenCV biometric similarity
  if (!matchResult && liveFrame) {
    try {
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001'
      const pyRes = await axios.post(`${pythonUrl}/api/face/compare-faces`, {
        liveFrame,
        referenceUrl: student?.facePhotoUrl || null
      }, { timeout: 4000 })
      if (pyRes.data && pyRes.data.success) {
        matchResult = {
          matched: pyRes.data.matched,
          similarity: pyRes.data.similarity
        }
      }
    } catch (pyErr) {
      console.warn('[verifyFace Python AI Warning]', pyErr.message)
    }
  }

  const verified = matchResult ? Boolean(matchResult.matched) : false
  const matchScore = matchResult ? (matchResult.similarity || 0) : 0

  // Save check result in VerificationAuditLog if DB available
  if (studentId && global.prisma?.verificationAuditLog) {
    try {
      await global.prisma.verificationAuditLog.create({
        data: {
          studentId,
          studentExamId: examId || null,
          checkType: 'EXAM_FACE_VERIFY',
          score: matchScore,
          status: verified ? 'PASS' : 'FLAGGED',
          details: JSON.stringify({ subjectId, matched: verified, score: matchScore })
        }
      })
    } catch (_auditErr) {
      // Non-blocking for response
    }
  }

  return {
    verified,
    matchScore,
    reason: verified ? 'Biometric match successful' : 'Biometric mismatch or verification service offline'
  }
}

/**
 * Verify student ID card photo using OCR
 */
async function verifyIdCardPhoto({ idCardBase64, expectedUsn, expectedName }) {
  if (!idCardBase64) {
    return { verified: false, score: 0, reason: 'ID card photo required' }
  }

  try {
    const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001'
    const pyRes = await axios.post(`${pythonUrl}/api/ocr/verify-id-card`, {
      image: idCardBase64,
      expectedUsn,
      expectedName
    }, { timeout: 8000 })

    if (pyRes.data && pyRes.data.success) {
      return {
        verified: pyRes.data.verified,
        usnFound: pyRes.data.usn_found,
        nameFound: pyRes.data.name_found,
        rawText: pyRes.data.extracted_text
      }
    }

    return { verified: false, score: 0, reason: 'OCR service could not parse card' }
  } catch (err) {
    console.warn('[verifyIdCard OCR Warning]', err.message)
    return { verified: false, score: 0, reason: 'OCR service unavailable' }
  }
}

/**
 * Save complete identity verification audit trail
 */
async function saveIdentityVerificationRecord({ studentId, faceMatchScore, ocrResult, ipAddress }) {
  if (!global.prisma?.identityVerification) return null

  const isApproved = faceMatchScore >= 0.70 && ocrResult?.verified

  const record = await global.prisma.identityVerification.create({
    data: {
      studentId,
      faceMatchScore,
      idCardVerified: Boolean(ocrResult?.verified),
      extractedUsn: ocrResult?.usnFound || null,
      status: isApproved ? 'AUTO_APPROVED' : 'FLAGGED_FOR_REVIEW',
      ipAddress
    }
  })

  return record
}

module.exports = {
  verifyFaceBiometrics,
  verifyIdCardPhoto,
  saveIdentityVerificationRecord
}
