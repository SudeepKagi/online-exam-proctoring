const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand
} = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post')
const { NodeHttpHandler } = require('@smithy/node-http-handler')
const https = require('https')
const http = require('http')
const crypto = require('crypto')
const { logger } = require('../../shared/logging')

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'proctornet-evidence'
const REGION = process.env.AWS_REGION || 'ap-south-1'
const IS_PROD = process.env.NODE_ENV === 'production'

// Configure NodeHttpHandler with connection pooling and timeouts (Notion 13.10)
const requestHandler = new NodeHttpHandler({
  connectionTimeout: 2000,
  socketTimeout: 5000,
  httpsAgent: new https.Agent({
    keepAlive: true,
    maxSockets: 100
  }),
  httpAgent: new http.Agent({
    keepAlive: true,
    maxSockets: 100
  })
})

const clientConfig = {
  region: REGION,
  maxAttempts: 3,
  requestHandler
}

// In production: no static keys — use EC2 instance role / default credential provider chain
// In dev/test: use env keys if provided
if (!IS_PROD && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
}

// S3 compatible endpoint (e.g. MinIO for dev/testing)
if (process.env.S3_ENDPOINT) {
  clientConfig.endpoint = process.env.S3_ENDPOINT
  clientConfig.forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true' || true
}

const s3Client = new S3Client(clientConfig)

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

/**
 * Returns a presigned GET URL for an S3 object key.
 * signingDate is rounded down to a 5-minute boundary so identical URLs are produced
 * within a 5-minute window for browser and CDN caching.
 */
async function getPresignedReadUrl(key, expiresIn = 600) {
  if (!key) return null

  const canonicalKey = extractS3Key(key)
  const roundedMs = Math.floor(Date.now() / 300000) * 300000
  const roundedSigningDate = new Date(roundedMs)

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: canonicalKey
    })

    return await getSignedUrl(s3Client, command, {
      expiresIn,
      signingDate: roundedSigningDate
    })
  } catch (err) {
    logger.warn({ key: canonicalKey, error: err.message }, 'Failed to presign read URL')
    return null
  }
}

/**
 * Batch-sign list responses using the exact same rounded signingDate
 */
async function batchPresignReadUrls(keys = [], expiresIn = 600) {
  if (!Array.isArray(keys) || keys.length === 0) return []

  const roundedMs = Math.floor(Date.now() / 300000) * 300000
  const roundedSigningDate = new Date(roundedMs)

  return Promise.all(
    keys.map(async (key) => {
      if (!key) return { key, url: null }
      const canonicalKey = extractS3Key(key)
      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: canonicalKey
        })
        const url = await getSignedUrl(s3Client, command, {
          expiresIn,
          signingDate: roundedSigningDate
        })
        return { key: canonicalKey, url }
      } catch (err) {
        return { key: canonicalKey, url: null }
      }
    })
  )
}

// ────────────────────────────────────────────────────────────
// Direct Presigned Upload Policies (Kills S-01 / S-03)
// ────────────────────────────────────────────────────────────

/**
 * Creates presigned POST credentials and presigned PUT URL for direct client-to-S3 upload
 */
async function createDirectUploadPolicy({ key, contentType, maxSizeBytes, expiresIn = 120 }) {
  const canonicalKey = extractS3Key(key)

  const conditions = [
    ['starts-with', '$Content-Type', 'image/'],
    ['content-length-range', 1, maxSizeBytes],
    ['eq', '$key', canonicalKey]
  ]

  const fields = {
    'Content-Type': contentType
  }

  let post = null
  try {
    post = await createPresignedPost(s3Client, {
      Bucket: BUCKET_NAME,
      Key: canonicalKey,
      Conditions: conditions,
      Fields: fields,
      Expires: expiresIn
    })
  } catch (err) {
    logger.warn({ error: err.message }, 'createPresignedPost warning, relying on presigned PUT')
  }

  // Also generate presigned PUT URL for maximum client flexibility
  const putCommand = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: canonicalKey,
    ContentType: contentType
  })

  const putUrl = await getSignedUrl(s3Client, putCommand, {
    expiresIn
  })

  return {
    key: canonicalKey,
    postUrl: post?.url || putUrl,
    fields: post?.fields || {},
    putUrl,
    contentType,
    maxSizeBytes,
    expiresIn
  }
}

// ────────────────────────────────────────────────────────────
// S3 Operations Helpers
// ────────────────────────────────────────────────────────────

async function headObject(key) {
  const canonicalKey = extractS3Key(key)
  const command = new HeadObjectCommand({
    Bucket: BUCKET_NAME,
    Key: canonicalKey
  })
  return await s3Client.send(command)
}

async function getObjectBuffer(key) {
  const canonicalKey = extractS3Key(key)
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: canonicalKey
  })
  const response = await s3Client.send(command)
  const chunks = []
  for await (const chunk of response.Body) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function putObject(key, buffer, contentType = 'image/webp') {
  const canonicalKey = extractS3Key(key)
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: canonicalKey,
    Body: buffer,
    ContentType: contentType,
    ServerSideEncryption: 'AES256'
  })
  return await s3Client.send(command)
}

async function deleteObject(key) {
  const canonicalKey = extractS3Key(key)
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: canonicalKey
  })
  return await s3Client.send(command)
}

async function deleteObjects(keys = []) {
  if (!keys || keys.length === 0) return { Deleted: [] }
  const objects = keys.map((k) => ({ Key: extractS3Key(k) }))
  const command = new DeleteObjectsCommand({
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: objects,
      Quiet: true
    }
  })
  return await s3Client.send(command)
}

async function getPresignedPutUrl(key, contentType = 'image/webp', expiresIn = 120) {
  if (!key) return null
  const canonicalKey = extractS3Key(key)
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: canonicalKey,
      ContentType: contentType,
      ServerSideEncryption: 'AES256'
    })
    return await getSignedUrl(s3Client, command, { expiresIn })
  } catch (err) {
    logger.warn({ key, error: err.message }, 'Failed to generate presigned PUT URL')
    throw err
  }
}

module.exports = {
  s3Client,
  BUCKET_NAME,
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
  deleteObjects
}
