'use strict'

const { getPresignedReadUrl, headObject } = require('../../infra/s3/s3.client')
const { logger } = require('../../shared/logging')

// In-memory cache for HeadObject existence checks: key -> { available: boolean, expiresAt: number }
const photoAvailabilityCache = new Map()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

async function checkObjectExists(key) {
  if (!key) return false
  const rawKey = typeof key === 'string' ? key.replace(/^s3:\/\/[^/]+\//, '').replace(/^\/+/, '') : null
  if (!rawKey) return false

  const now = Date.now()
  const cached = photoAvailabilityCache.get(rawKey)
  if (cached && cached.expiresAt > now) {
    return cached.available
  }

  let available = false
  try {
    await headObject(rawKey)
    available = true
  } catch (err) {
    available = false
  }

  photoAvailabilityCache.set(rawKey, { available, expiresAt: now + CACHE_TTL_MS })
  return available
}

function invalidatePhotoCache(key) {
  if (!key) return
  const rawKey = typeof key === 'string' ? key.replace(/^s3:\/\/[^/]+\//, '').replace(/^\/+/, '') : null
  if (rawKey) {
    photoAvailabilityCache.delete(rawKey)
  }
}

/**
 * Single async serializer for Student profiles (Prompt 12 / S-1).
 * Presigns facePhotoUrl and idCardPhotoUrl.
 * Computes photoAvailable and idPhotoAvailable booleans via cached HeadObject.
 */
async function presentStudent(student) {
  if (!student) return null

  const faceKey = student.facePhotoKey || null
  const idKey = student.idCardPhotoKey || student.idDocumentKey || null

  // Check object existence via cached HeadObject (TTL 10 min)
  const [photoAvailable, idPhotoAvailable] = await Promise.all([
    checkObjectExists(faceKey),
    checkObjectExists(idKey)
  ])

  // Presign URLs (validity 3600s = 1h) only if object exists
  const [facePhotoUrl, idCardPhotoUrl] = await Promise.all([
    photoAvailable ? getPresignedReadUrl(faceKey, 3600) : null,
    idPhotoAvailable ? getPresignedReadUrl(idKey, 3600) : null
  ])

  return {
    id: student.id,
    name: student.name,
    usn: student.usn,
    email: student.email,
    departmentCode: student.departmentCode || null,
    department: student.department?.name || student.departmentCode || null,
    semester: student.semester || null,
    phone: student.phone || null,
    facePhotoKey: student.facePhotoKey || null,
    facePhotoUrl: facePhotoUrl || null,
    idCardPhotoKey: student.idCardPhotoKey || null,
    idCardPhotoUrl: idCardPhotoUrl || null,
    photoAvailable,
    idPhotoAvailable,
    idDocumentKey: student.idDocumentKey || null,
    idCroppedFaceKey: student.idCroppedFaceKey || null,
    faceMatchScore: student.faceMatchScore ?? null,
    profileStatus: student.profileStatus || null,
    approvalStatus: student.approvalStatus || null,
    isSuspended: Boolean(student.isSuspended),
    mustChangePassword: Boolean(student.mustChangePassword),
    rejectionReason: student.rejectionReason || null,
    approvedBy: student.approvedBy || null,
    approvedAt: student.approvedAt || null,
    consentTimestamp: student.consentTimestamp || null,
    tempPassword: student.tempPassword || undefined,
    createdAt: student.createdAt || null
  }
}

async function presentStudents(students = []) {
  if (!Array.isArray(students) || students.length === 0) return []
  return Promise.all(students.map((s) => presentStudent(s)))
}

module.exports = {
  presentStudent,
  presentStudents,
  checkObjectExists,
  invalidatePhotoCache,
  _photoAvailabilityCache: photoAvailabilityCache
}
