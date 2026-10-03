const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')

// Initialize S3 Client
const region = process.env.AWS_REGION || 'ap-south-1'
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'proctornet-evidence-storage'

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

/**
 * Helper to extract S3 Object Key from a URL or raw key.
 */
function extractS3Key(urlOrKey) {
  if (!urlOrKey) return null
  if (typeof urlOrKey !== 'string') return null

  // If it's already a relative key
  if (!urlOrKey.startsWith('http://') && !urlOrKey.startsWith('https://')) {
    return urlOrKey.replace(/^\/+/, '')
  }

  try {
    const parsed = new URL(urlOrKey)
    // Format: https://bucket.s3.region.amazonaws.com/path/to/key
    // pathname: /path/to/key
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
  } catch {
    return urlOrKey
  }
}

/**
 * Generate a pre-signed view URL for an S3 key (valid up to 7 days).
 * @param {string} keyOrUrl - S3 key or full S3 URL
 * @param {number} expiresInSeconds - Expiration time in seconds (max 604800 = 7 days)
 * @returns {Promise<string>}
 */
async function getPresignedUrl(keyOrUrl, expiresInSeconds = 604800) {
  try {
    const key = extractS3Key(keyOrUrl)
    if (!key) return keyOrUrl

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    })

    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds })
  } catch (err) {
    console.warn('[S3 Service] Error generating presigned URL:', err.message)
    return keyOrUrl
  }
}

/**
 * Upload a raw Buffer to S3.
 * @param {Buffer} buffer - File buffer
 * @param {string} folder - Destination folder (e.g. 'evidence', 'students/face')
 * @param {string} filename - Optional custom filename
 * @param {string} mimeType - e.g. 'image/jpeg', 'video/webm'
 * @returns {Promise<Object>} Object with { url, secure_url, key, bucket, toString() }
 */
async function uploadBuffer(buffer, folder = 'evidence', filename = null, mimeType = 'image/jpeg') {
  try {
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '')
    const uniqueSuffix = crypto.randomBytes(8).toString('hex')
    const ext = mimeType.includes('webp') ? '.webp'
      : mimeType.includes('png') ? '.png'
      : mimeType.includes('webm') ? '.webm'
      : mimeType.includes('mp4') ? '.mp4'
      : mimeType.includes('pdf') ? '.pdf'
      : '.jpg'

    const finalFilename = filename || `${Date.now()}_${uniqueSuffix}${ext}`
    const key = `${cleanFolder}/${finalFilename}`

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })

    await s3Client.send(command)

    // Generate a 7-day presigned URL for immediate, authorized browser rendering
    const signedUrl = await getPresignedUrl(key, 604800)
    const directS3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`

    // Return a rich response compatible with both Cloudinary expectations and direct string usage
    const resultObj = {
      url: signedUrl,
      secure_url: signedUrl,
      directUrl: directS3Url,
      key,
      bucket: bucketName,
      toString() {
        return signedUrl
      },
    }

    return resultObj
  } catch (err) {
    console.error('[S3 Service] Upload buffer failed:', err.message)
    throw err
  }
}

/**
 * Upload Base64 Data URL or raw base64 string to AWS S3.
 * Compatible replacement for Cloudinary uploadBase64.
 *
 * @param {string} dataUrl - e.g. 'data:image/jpeg;base64,...' or raw base64
 * @param {string} folder - Destination folder (e.g. 'proctornet/students')
 * @param {string} filename - Optional custom filename
 * @returns {Promise<Object>} Object with { url, secure_url, key, toString() }
 */
async function uploadBase64(dataUrl, folder = 'evidence', filename = null) {
  if (!dataUrl) return null

  // If already an HTTP/HTTPS URL, return it directly
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    return {
      url: dataUrl,
      secure_url: dataUrl,
      key: extractS3Key(dataUrl),
      toString() { return dataUrl },
    }
  }

  try {
    let mimeType = 'image/jpeg'
    let base64String = dataUrl

    // Detect MIME type from Data URL header
    const match = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/)
    if (match) {
      mimeType = match[1]
      base64String = match[2]
    } else {
      // Fallback: strip any partial header if present
      base64String = dataUrl.replace(/^data:[^;]+;base64,/, '')
    }

    const buffer = Buffer.from(base64String, 'base64')
    return await uploadBuffer(buffer, folder, filename, mimeType)
  } catch (err) {
    console.warn('[S3 Service] Base64 upload failed:', err.message)
    // Fall back to original dataUrl if upload fails so data is not lost
    return {
      url: dataUrl,
      secure_url: dataUrl,
      key: null,
      toString() { return dataUrl },
    }
  }
}

/**
 * Upload a local file from disk to S3.
 */
async function uploadFile(filePath, folder = 'evidence') {
  const buffer = fs.readFileSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
  }
  const mimeType = mimeMap[ext] || 'application/octet-stream'
  const filename = path.basename(filePath)
  return await uploadBuffer(buffer, folder, filename, mimeType)
}

/**
 * Delete an object from S3 by URL or Key.
 */
async function deleteByUrl(urlOrKey) {
  try {
    const key = extractS3Key(urlOrKey)
    if (!key) return

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
    await s3Client.send(command)
    console.log(`[S3 Service] Deleted object: ${key}`)
  } catch (e) {
    console.warn('[S3 Service] Delete failed:', e.message)
  }
}

/**
 * Store periodic webcam or screen snapshot (replaces MinIO / local disk)
 */
async function storeSnapshot(studentExamId, frameBase64, frameType = 'webcam') {
  try {
    const folder = `evidence/snapshots/${studentExamId}`
    const filename = `${frameType}_${Date.now()}.jpg`
    const res = await uploadBase64(frameBase64, folder, filename)
    return res?.secure_url || res?.url || null
  } catch (err) {
    console.error('[S3 Service] Error storing snapshot:', err.message)
    return null
  }
}

/**
 * Store 60-second violation clip evidence (replaces MinIO / local disk)
 */
async function storeEvidenceClip(studentExamId, violationType, clipBase64) {
  try {
    const folder = `evidence/clips/${studentExamId}`
    const filename = `clip_${violationType}_${Date.now()}.webm`
    const res = await uploadBase64(clipBase64, folder, filename)
    return res?.secure_url || res?.url || null
  } catch (err) {
    console.error('[S3 Service] Error storing evidence clip:', err.message)
    return null
  }
}

const uploadToS3 = uploadBase64
const uploadToCloudinary = uploadBase64 // backwards compatibility alias

module.exports = {
  s3Client,
  uploadBuffer,
  uploadBase64,
  uploadFile,
  deleteByUrl,
  getPresignedUrl,
  extractS3Key,
  storeSnapshot,
  storeEvidenceClip,
  uploadToS3,
  uploadToCloudinary,
}
