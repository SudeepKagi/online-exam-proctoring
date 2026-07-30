const comprefaceService = require('../services/compreface.service')
const pythonService = require('../services/python.service')
const { uploadToCloudinary } = require('../services/cloudinary.service')
const { logAudit } = require('../utils/auditLogger')
const { getClientIp } = require('../utils/helpers')

/**
 * Fuzzy match helper using Levenshtein distance
 */
function calculateLevenshteinDistance(a, b) {
  if (!a || !b) return 100
  const str1 = a.toLowerCase().trim()
  const str2 = b.toLowerCase().trim()

  const matrix = []
  for (let i = 0; i <= str2.length; i++) matrix[i] = [i]
  for (let j = 0; j <= str1.length; j++) matrix[0][j] = j

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

function calculateFuzzySimilarity(a, b) {
  if (!a || !b) return 0.0
  const dist = calculateLevenshteinDistance(a, b)
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1.0
  return Math.max(0.0, 1.0 - dist / maxLen)
}

/**
 * POST /api/enrollment/consent
 * Record student's explicit biometric processing consent
 */
async function submitConsent(req, res) {
  try {
    const studentId = req.user.id

    const student = await global.prisma.student.update({
      where: { id: studentId },
      data: {
        consentTimestamp: new Date(),
      },
    })

    logAudit({
      userId: studentId,
      userRole: 'student',
      action: 'BIOMETRIC_CONSENT_GIVEN',
      details: 'Student provided explicit biometric processing consent',
      ipAddress: getClientIp(req),
      studentId,
    })

    return res.json({
      success: true,
      message: 'Consent recorded successfully.',
      consentTimestamp: student.consentTimestamp,
    })
  } catch (error) {
    console.error('[submitConsent]', error)
    return res.status(500).json({ error: 'Failed to record consent: ' + error.message })
  }
}

/**
 * POST /api/enrollment/face
 * Step A: Live selfie capture + anti-spoofing + CompreFace embedding registration
 */
async function enrollFace(req, res) {
  try {
    const studentId = req.user.id
    const { image } = req.body // Base64 data URI or image URL

    if (!image) {
      return res.status(400).json({ error: 'Live face selfie image is required.' })
    }

    const student = await global.prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' })
    }

    if (student.profileStatus === 'LOCKED' || student.profileStatus === 'VERIFIED') {
      return res.status(403).json({ error: 'Your profile biometrics are locked and verified.' })
    }

    // 1. Anti-Spoofing / Liveness Check via Python service
    const livenessResult = await pythonService.checkLiveness(image)
    if (!livenessResult.isReal) {
      return res.status(400).json({
        error: 'Anti-spoofing check failed. Please ensure you are capturing a clear, live selfie.',
        livenessScore: livenessResult.livenessScore,
      })
    }

    // 2. Upload face image to Cloud Storage / Cloudinary
    let uploadedFaceUrl = image
    try {
      const uploadRes = await uploadToCloudinary(image, `proctornet/students/face_${student.usn}`)
      uploadedFaceUrl = uploadRes.secure_url || image
    } catch (e) {
      console.warn('[enrollFace Cloudinary Warning]', e.message)
    }

    // 3. Register Subject & Face in CompreFace REST API
    const comprefaceRes = await comprefaceService.addFaceToSubject(student.usn, image)

    // 4. Update Student DB record
    await global.prisma.student.update({
      where: { id: studentId },
      data: {
        facePhotoUrl: uploadedFaceUrl,
        faceSubjectId: student.usn,
        faceEmbeddingRef: comprefaceRes.image_id || `emb_${Date.now()}`,
      },
    })

    // Log Verification Audit
    await global.prisma.verificationAuditLog.create({
      data: {
        studentId,
        checkType: 'ENROLLMENT_FACE',
        score: livenessResult.livenessScore || 1.0,
        status: 'PASS',
        details: JSON.stringify({ faceSubjectId: student.usn, comprefaceRef: comprefaceRes.image_id }),
      },
    })

    logAudit({
      userId: studentId,
      userRole: 'student',
      action: 'BIOMETRIC_FACE_ENROLLED',
      details: `Registered face embedding under CompreFace subject ${student.usn}`,
      ipAddress: getClientIp(req),
      studentId,
    })

    return res.json({
      success: true,
      message: 'Live face enrolled successfully.',
      facePhotoUrl: uploadedFaceUrl,
      faceSubjectId: student.usn,
    })
  } catch (error) {
    console.error('[enrollFace]', error)
    return res.status(500).json({ error: 'Face enrollment failed: ' + error.message })
  }
}

/**
 * POST /api/enrollment/id
 * Step B: Upload ID Card -> PaddleOCR -> MTCNN Face Crop -> Fuzzy Match -> Submit Profile
 */
async function enrollIdDocument(req, res) {
  try {
    const studentId = req.user.id
    const { idCardImage } = req.body

    if (!idCardImage) {
      return res.status(400).json({ error: 'ID card document image is required.' })
    }

    const student = await global.prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' })
    }

    if (student.profileStatus === 'LOCKED' || student.profileStatus === 'VERIFIED') {
      return res.status(403).json({ error: 'Your profile biometrics are locked and verified.' })
    }

    // 1. Upload ID card image to Cloudinary
    let uploadedIdUrl = idCardImage
    try {
      const uploadRes = await uploadToCloudinary(idCardImage, `proctornet/students/id_${student.usn}`)
      uploadedIdUrl = uploadRes.secure_url || idCardImage
    } catch (e) {
      console.warn('[enrollIdDocument Cloudinary Warning]', e.message)
    }

    // 2. Perform PaddleOCR / Tesseract OCR on ID Card
    const ocrResult = await pythonService.verifyIdCardOcr(idCardImage)

    // 3. Crop Face from ID Card via MTCNN / OpenCV
    const cropResult = await pythonService.cropIdFace(idCardImage)
    const croppedFaceUrl = cropResult.croppedFaceBase64 || uploadedIdUrl

    // 4. Calculate Fuzzy Match score against student's admin record
    const extractedName = ocrResult.extractedName || ''
    const extractedUsn = ocrResult.extractedUsn || ''

    const nameSim = calculateFuzzySimilarity(student.name, extractedName)
    const usnSim = calculateFuzzySimilarity(student.usn, extractedUsn)
    const combinedConfidence = Math.max(nameSim, usnSim, extractedUsn ? (extractedUsn.includes(student.usn) ? 1.0 : 0.5) : 0.7)

    const isMatchFlagged = combinedConfidence < 0.60

    // 5. Update Student DB record & status to SUBMITTED
    const updatedStudent = await global.prisma.student.update({
      where: { id: studentId },
      data: {
        idCardPhotoUrl: uploadedIdUrl,
        idDocumentUrl: uploadedIdUrl,
        idCroppedFaceUrl: croppedFaceUrl,
        idOcrFields: {
          extractedUsn,
          extractedName,
          extractedDob: ocrResult.extractedDob || null,
          rawText: ocrResult.rawText || '',
          confidenceScore: combinedConfidence,
          isMatchFlagged,
        },
        profileStatus: 'SUBMITTED',
      },
    })

    // Log Verification Audit
    await global.prisma.verificationAuditLog.create({
      data: {
        studentId,
        checkType: 'ENROLLMENT_ID',
        score: combinedConfidence,
        status: isMatchFlagged ? 'FLAGGED' : 'PASS',
        details: JSON.stringify({ extractedUsn, extractedName, nameSim, usnSim }),
      },
    })

    logAudit({
      userId: studentId,
      userRole: 'student',
      action: 'BIOMETRIC_ID_ENROLLED',
      details: `Submitted ID document for verification (Confidence: ${Math.round(combinedConfidence * 100)}%)`,
      ipAddress: getClientIp(req),
      studentId,
    })

    return res.json({
      success: true,
      message: 'ID document submitted successfully for verification.',
      profileStatus: updatedStudent.profileStatus,
      ocrData: {
        extractedUsn,
        extractedName,
        confidenceScore: combinedConfidence,
        isMatchFlagged,
      },
    })
  } catch (error) {
    console.error('[enrollIdDocument]', error)
    return res.status(500).json({ error: 'ID document enrollment failed: ' + error.message })
  }
}

/**
 * GET /api/enrollment/status
 * Get current student's biometric enrollment status
 */
async function getEnrollmentStatus(req, res) {
  try {
    const studentId = req.user.id
    const student = await global.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        usn: true,
        department: true,
        profileStatus: true,
        consentTimestamp: true,
        facePhotoUrl: true,
        idDocumentUrl: true,
        idCroppedFaceUrl: true,
        idOcrFields: true,
        rejectionReason: true,
        biometricEnrollDeadline: true,
      },
    })

    if (!student) {
      return res.status(404).json({ error: 'Student profile not found.' })
    }

    return res.json({ success: true, enrollment: student })
  } catch (error) {
    console.error('[getEnrollmentStatus]', error)
    return res.status(500).json({ error: 'Failed to fetch enrollment status.' })
  }
}

/**
 * GET /api/admin/enrollment-review
 * Admin list of student biometric submissions for verification review
 */
async function listEnrollmentSubmissions(req, res) {
  try {
    const { status = 'SUBMITTED' } = req.query

    const students = await global.prisma.student.findMany({
      where: status === 'ALL' ? {} : { profileStatus: status },
      select: {
        id: true,
        name: true,
        usn: true,
        department: true,
        semester: true,
        profileStatus: true,
        consentTimestamp: true,
        facePhotoUrl: true,
        idDocumentUrl: true,
        idCroppedFaceUrl: true,
        idOcrFields: true,
        rejectionReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.json({ success: true, count: students.length, records: students })
  } catch (error) {
    console.error('[listEnrollmentSubmissions]', error)
    return res.status(500).json({ error: 'Failed to retrieve enrollment submissions.' })
  }
}

/**
 * POST /api/admin/enrollment-review/:id/approve
 * Admin approves student biometric enrollment -> locks profile
 */
async function approveEnrollment(req, res) {
  try {
    const { id: studentId } = req.params
    const adminId = req.user.id

    const student = await global.prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' })
    }

    const updated = await global.prisma.student.update({
      where: { id: studentId },
      data: {
        profileStatus: 'VERIFIED',
        approvedBy: adminId,
        approvedAt: new Date(),
        rejectionReason: null,
      },
    })

    logAudit({
      userId: adminId,
      userRole: 'admin',
      action: 'BIOMETRIC_ENROLLMENT_APPROVED',
      details: `Approved biometrics for student ${student.name} (${student.usn})`,
      ipAddress: getClientIp(req),
      studentId,
    })

    return res.json({
      success: true,
      message: `Biometrics approved and locked for ${student.name}.`,
      profileStatus: updated.profileStatus,
    })
  } catch (error) {
    console.error('[approveEnrollment]', error)
    return res.status(500).json({ error: 'Failed to approve enrollment: ' + error.message })
  }
}

/**
 * POST /api/admin/enrollment-review/:id/reject
 * Admin rejects student biometric enrollment with reason
 */
async function rejectEnrollment(req, res) {
  try {
    const { id: studentId } = req.params
    const adminId = req.user.id
    const { reason = 'ID/Selfie photo mismatch or unclear image quality.' } = req.body

    const student = await global.prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' })
    }

    const updated = await global.prisma.student.update({
      where: { id: studentId },
      data: {
        profileStatus: 'REJECTED',
        rejectionReason: reason,
      },
    })

    logAudit({
      userId: adminId,
      userRole: 'admin',
      action: 'BIOMETRIC_ENROLLMENT_REJECTED',
      details: `Rejected biometrics for student ${student.usn}. Reason: ${reason}`,
      ipAddress: getClientIp(req),
      studentId,
    })

    return res.json({
      success: true,
      message: `Enrollment rejected for ${student.name}. Student can now re-enroll.`,
      profileStatus: updated.profileStatus,
    })
  } catch (error) {
    console.error('[rejectEnrollment]', error)
    return res.status(500).json({ error: 'Failed to reject enrollment: ' + error.message })
  }
}

/**
 * POST /api/admin/enrollment-override
 * Reset/Unlock a locked biometric profile with mandatory approver reason logging
 */
async function overrideEnrollment(req, res) {
  try {
    const adminId = req.user.id
    const { studentId, newStatus = 'PENDING', reason } = req.body

    if (!studentId || !reason) {
      return res.status(400).json({ error: 'studentId and override reason are required.' })
    }

    const student = await global.prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' })
    }

    const prevStatus = student.profileStatus

    await global.prisma.biometricOverrideLog.create({
      data: {
        studentId,
        approverId: adminId,
        reason,
        prevStatus,
        newStatus,
      },
    })

    const updated = await global.prisma.student.update({
      where: { id: studentId },
      data: {
        profileStatus: newStatus,
        rejectionReason: newStatus === 'PENDING' ? `Unlocked by Admin: ${reason}` : student.rejectionReason,
      },
    })

    logAudit({
      userId: adminId,
      userRole: 'admin',
      action: 'BIOMETRIC_OVERRIDE_EXECUTED',
      details: `Status overridden from ${prevStatus} to ${newStatus}. Reason: ${reason}`,
      ipAddress: getClientIp(req),
      studentId,
    })

    return res.json({
      success: true,
      message: `Profile status updated to ${newStatus}.`,
      prevStatus,
      newStatus: updated.profileStatus,
    })
  } catch (error) {
    console.error('[overrideEnrollment]', error)
    return res.status(500).json({ error: 'Failed to execute override: ' + error.message })
  }
}

/**
 * POST /api/exam/verify-face
 * Exam-day live selfie face verification against CompreFace subject embedding
 */
async function verifyExamFace(req, res) {
  try {
    const studentId = req.user.id
    const { liveImage, studentExamId } = req.body

    if (!liveImage) {
      return res.status(400).json({ error: 'Live image capture is required.' })
    }

    const student = await global.prisma.student.findUnique({ where: { id: studentId } })
    if (!student || !student.faceSubjectId) {
      return res.status(400).json({ error: 'Student has not completed mandatory biometric face enrollment.' })
    }

    // 1. Recognize live selfie against stored subject ID in CompreFace
    const comprefaceResult = await comprefaceService.recognizeFace(liveImage, student.usn)
    const score = comprefaceResult.similarity || 0.0

    let status = 'FAIL'
    let message = 'Face identity verification failed.'

    if (comprefaceResult.matched && score >= 0.85) {
      status = 'PASS'
      message = 'Face identity verified successfully.'
    } else if (score >= 0.65) {
      status = 'FLAGGED'
      message = 'Face identity match confidence is moderate. Flagged for proctor review.'
    }

    // Log check result to Audit Log table
    await global.prisma.verificationAuditLog.create({
      data: {
        studentId,
        studentExamId: studentExamId || null,
        checkType: 'EXAM_FACE_VERIFY',
        score,
        status,
        details: JSON.stringify({ expectedSubject: student.usn, comprefaceMatched: comprefaceResult.matched }),
      },
    })

    return res.json({
      success: status !== 'FAIL',
      status,
      score,
      message,
    })
  } catch (error) {
    console.error('[verifyExamFace]', error)
    return res.status(500).json({ error: 'Exam face verification failed: ' + error.message })
  }
}

/**
 * POST /api/exam/verify-id
 * Exam-day live ID verification check
 */
async function verifyExamId(req, res) {
  try {
    const studentId = req.user.id
    const { idImage, studentExamId } = req.body

    if (!idImage) {
      return res.status(400).json({ error: 'ID card image is required.' })
    }

    const student = await global.prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' })
    }

    const ocrResult = await pythonService.verifyIdCardOcr(idImage)

    const isUsnMatch = ocrResult.extractedUsn ? ocrResult.extractedUsn.includes(student.usn) : false
    const score = isUsnMatch ? 1.0 : (ocrResult.extractedName ? calculateFuzzySimilarity(student.name, ocrResult.extractedName) : 0.70)

    const status = score >= 0.60 ? 'PASS' : 'FLAGGED'

    await global.prisma.verificationAuditLog.create({
      data: {
        studentId,
        studentExamId: studentExamId || null,
        checkType: 'EXAM_ID_VERIFY',
        score,
        status,
        details: JSON.stringify({ extractedUsn: ocrResult.extractedUsn, extractedName: ocrResult.extractedName }),
      },
    })

    return res.json({
      success: true,
      status,
      score,
      extractedUsn: ocrResult.extractedUsn,
      message: status === 'PASS' ? 'ID card verified.' : 'ID card details require proctor check.',
    })
  } catch (error) {
    console.error('[verifyExamId]', error)
    return res.status(500).json({ error: 'Exam ID verification failed: ' + error.message })
  }
}

module.exports = {
  submitConsent,
  enrollFace,
  enrollIdDocument,
  getEnrollmentStatus,
  listEnrollmentSubmissions,
  approveEnrollment,
  rejectEnrollment,
  overrideEnrollment,
  verifyExamFace,
  verifyExamId,
}
