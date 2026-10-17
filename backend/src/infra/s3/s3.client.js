'use strict'

const crypto = require('crypto')
const { AwsS3Adapter, MemoryS3Adapter } = require('./s3Adapter')
const { logger } = require('../../shared/logging')

const BUCKET_NAME = process.env.S3_BUCKET || 'proctornet-storage'
const REGION = process.env.AWS_REGION || 'ap-south-1'
const IS_PROD = process.env.NODE_ENV === 'production'

// In-memory mock store for CI and offline test environments without active MinIO/AWS S3
const USE_MOCK = !IS_PROD && (process.env.S3_MOCK === 'true' || (process.env.NODE_ENV === 'test' && !process.env.S3_ENDPOINT))

// Default storage adapter instance
// In production: no static keys — use EC2 instance role / default credential provider chain
// In dev/test: use MemoryS3Adapter when USE_MOCK is set
let activeAdapter
if (!IS_PROD) {
  if (USE_MOCK) {
    activeAdapter = new MemoryS3Adapter({ bucket: BUCKET_NAME })
  } else {
    activeAdapter = new AwsS3Adapter({ bucket: BUCKET_NAME, region: REGION })
  }
} else {
  activeAdapter = new AwsS3Adapter({ bucket: BUCKET_NAME, region: REGION })
}

/**
 * Allow injecting a storage adapter (e.g. MemoryS3Adapter in unit tests)
 */
function setStorageAdapter(adapter) {
  if (activeAdapter && typeof activeAdapter.destroy === 'function') {
    activeAdapter.destroy()
  }
  activeAdapter = adapter
}

function getStorageAdapter() {
  return activeAdapter
}

// ────────────────────────────────────────────────────────────
// ADR-011 Key Construction Schemes (Keys, not URLs)
// ────────────────────────────────────────────────────────────

function buildIdentityKey(studentId, kind = 'profile', uuid = crypto.randomUUID()) {
  return `identity/${studentId}/${kind}-${uuid}.webp`
}

function buildEvidenceKey(examId, attemptId, uuid = crypto.randomUUID()) {
  return `evidence/${examId}/${attemptId}/${uuid}.webp`
}

function buildThumbKey(examId, attemptId, uuid = crypto.randomUUID()) {
  return `thumbs/${examId}/${attemptId}/${uuid}.webp`
}

function buildQuestionKey(examId, uuid = crypto.randomUUID()) {
  return `questions/${examId}/${uuid}.webp`
}

function buildLiveSnapshotKey(examId, attemptId, type = 'camera') {
  return `live/${examId}/${attemptId}/${type}.webp`
}

/**
 * Extract canonical S3 key from a full URL or relative path if needed
 */
function extractS3Key(urlOrKey) {
  if (!urlOrKey) return null
  if (!urlOrKey.startsWith('http://') && !urlOrKey.startsWith('https://')) {
    return urlOrKey.replace(/^\/+/, '')
  }
  try {
    const url = new URL(urlOrKey)
    let pathname = url.pathname.replace(/^\/+/, '')
    if (pathname.startsWith(`${BUCKET_NAME}/`)) {
      pathname = pathname.substring(BUCKET_NAME.length + 1)
    }
    return pathname
  } catch {
    return urlOrKey
  }
}

// ────────────────────────────────────────────────────────────
// Presigning on Read with 5-Minute Window Cache Invariant (ADR-011)
// ────────────────────────────────────────────────────────────

async function getPresignedReadUrl(key, expiresIn = 600) {
  if (!key) return null
  const canonicalKey = extractS3Key(key)
  const roundedMs = Math.floor(Date.now() / 300000) * 300000
  const roundedSigningDate = new Date(roundedMs)

  try {
    return await activeAdapter.getPresignedReadUrl(canonicalKey, expiresIn, roundedSigningDate)
  } catch (err) {
    logger.warn({ key: canonicalKey, error: err.message }, 'Failed to presign read URL')
    return null
  }
}

async function batchPresignReadUrls(keys = [], expiresIn = 600) {
  if (!Array.isArray(keys) || keys.length === 0) return []
  const roundedMs = Math.floor(Date.now() / 300000) * 300000
  const roundedSigningDate = new Date(roundedMs)

  return Promise.all(
    keys.map(async (key) => {
      if (!key) return { key, url: null }
      const canonicalKey = extractS3Key(key)
      try {
        const url = await activeAdapter.getPresignedReadUrl(canonicalKey, expiresIn, roundedSigningDate)
        return { key: canonicalKey, url }
      } catch (err) {
        return { key: canonicalKey, url: null }
      }
    })
  )
}

async function createDirectUploadPolicy({ key, contentType, maxSizeBytes, expiresIn = 120 }) {
  const canonicalKey = extractS3Key(key)
  return activeAdapter.createDirectUploadPolicy({
    key: canonicalKey,
    contentType,
    maxSizeBytes,
    expiresIn
  })
}

// ────────────────────────────────────────────────────────────
// S3 Operations Helpers
// ────────────────────────────────────────────────────────────

async function headObject(key) {
  const canonicalKey = extractS3Key(key)
  return activeAdapter.headObject(canonicalKey)
}

async function getObjectBuffer(key) {
  const canonicalKey = extractS3Key(key)
  return activeAdapter.getObjectBuffer(canonicalKey)
}

async function putObject(key, buffer, contentType = 'image/webp') {
  const canonicalKey = extractS3Key(key)
  return activeAdapter.putObject(canonicalKey, buffer, contentType)
}

async function deleteObject(key) {
  const canonicalKey = extractS3Key(key)
  return activeAdapter.deleteObject(canonicalKey)
}

async function deleteObjects(keys = []) {
  if (!keys || keys.length === 0) return { Deleted: [] }
  const canonicalKeys = keys.map(extractS3Key)
  return activeAdapter.deleteObjects(canonicalKeys)
}

async function getPresignedPutUrl(key, contentType = 'image/webp', expiresIn = 120) {
  if (!key) return null
  const canonicalKey = extractS3Key(key)
  return activeAdapter.getPresignedPutUrl(canonicalKey, contentType, expiresIn)
}

module.exports = {
  get s3Client() {
    return activeAdapter.client || activeAdapter
  },
  BUCKET_NAME,
  setStorageAdapter,
  getStorageAdapter,
  buildIdentityKey,
  buildEvidenceKey,
  buildThumbKey,
  buildQuestionKey,
  buildLiveSnapshotKey,
  extractS3Key,
  getPresignedReadUrl,
  getPresignedPutUrl,
  batchPresignReadUrls,
  createDirectUploadPolicy,
  headObject,
  getObjectBuffer,
  putObject,
  deleteObject,
  deleteObjects,
  destroy: () => {
    try { activeAdapter.destroy() } catch (_) {}
  }
}
