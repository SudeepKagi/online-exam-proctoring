/**
 * Cloudinary & AWS S3 Evidence Storage Bridge
 * Default primary: AWS S3 Bucket
 * Fallback: Cloudinary (if S3 not configured)
 */
const s3Service = require('./s3.service')

const hasAws = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_S3_BUCKET_NAME)

let cloudinary = null
let streamifier = null

if (!hasAws) {
  try {
    cloudinary = require('cloudinary').v2
    streamifier = require('streamifier')
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })
  } catch (err) {
    console.warn('[Storage Bridge] Cloudinary module not loaded:', err.message)
  }
}

/**
 * Upload a buffer to S3 (or Cloudinary fallback).
 */
async function uploadBuffer(buffer, folder = 'proctornet', publicId = null, mimeType = 'image/jpeg') {
  if (hasAws) {
    const res = await s3Service.uploadBuffer(buffer, folder, publicId, mimeType)
    return res.secure_url
  }

  if (cloudinary) {
    return new Promise((resolve, reject) => {
      const opts = {
        folder,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      }
      if (publicId) opts.public_id = publicId

      const uploadStream = cloudinary.uploader.upload_stream(opts, (error, result) => {
        if (error) return reject(error)
        resolve(result.secure_url)
      })

      streamifier.createReadStream(buffer).pipe(uploadStream)
    })
  }

  throw new Error('No storage provider configured (AWS S3 or Cloudinary)')
}

/**
 * Upload a base64 data URL to S3 (or Cloudinary fallback).
 */
async function uploadBase64(dataUrl, folder = 'proctornet', filename = null) {
  if (hasAws) {
    const res = await s3Service.uploadBase64(dataUrl, folder, filename)
    return res.secure_url || res.url || dataUrl
  }

  if (cloudinary) {
    try {
      const result = await cloudinary.uploader.upload(dataUrl, {
        folder,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      })
      return result.secure_url
    } catch (err) {
      console.warn('[Cloudinary] Upload failed, falling back to base64:', err.message)
      return dataUrl
    }
  }

  return dataUrl
}

/**
 * Upload from a local file path.
 */
async function uploadFile(filePath, folder = 'proctornet') {
  if (hasAws) {
    const res = await s3Service.uploadFile(filePath, folder)
    return res.secure_url
  }

  if (cloudinary) {
    const result = await cloudinary.uploader.upload(filePath, { folder })
    return result.secure_url
  }

  throw new Error('No storage provider configured')
}

/**
 * Delete an asset by URL.
 */
async function deleteByUrl(url) {
  if (hasAws && (url.includes('.amazonaws.com') || !url.startsWith('http'))) {
    return await s3Service.deleteByUrl(url)
  }

  if (cloudinary) {
    try {
      const parts = url.split('/')
      const filename = parts[parts.length - 1].split('.')[0]
      const folder = parts[parts.length - 2]
      await cloudinary.uploader.destroy(`${folder}/${filename}`)
    } catch (e) {
      console.warn('[Cloudinary] Delete failed:', e.message)
    }
  }
}

const uploadToCloudinary = uploadBase64
const uploadToS3 = uploadBase64

module.exports = {
  uploadBuffer,
  uploadBase64,
  uploadFile,
  deleteByUrl,
  uploadToCloudinary,
  uploadToS3,
}
