const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer   - file buffer from multer memoryStorage
 * @param {string} folder   - Cloudinary folder name
 * @param {string} publicId - optional custom public_id
 * @returns {Promise<string>} secure_url
 */
function uploadBuffer(buffer, folder = 'proctornet', publicId = null) {
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

/**
 * Upload a base64 data URL to Cloudinary.
 * @param {string} dataUrl  - 'data:image/jpeg;base64,...'
 * @param {string} folder
 * @returns {Promise<string>} secure_url
 */
async function uploadBase64(dataUrl, folder = 'proctornet') {
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder,
    resource_type: 'image',
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  })
  return result.secure_url
}

/**
 * Upload from a local file path.
 */
async function uploadFile(filePath, folder = 'proctornet') {
  const result = await cloudinary.uploader.upload(filePath, { folder })
  return result.secure_url
}

/**
 * Delete a Cloudinary asset by URL.
 */
async function deleteByUrl(url) {
  try {
    // Extract public_id from URL
    const parts    = url.split('/')
    const filename = parts[parts.length - 1].split('.')[0]
    const folder   = parts[parts.length - 2]
    await cloudinary.uploader.destroy(`${folder}/${filename}`)
  } catch (e) {
    console.warn('[Cloudinary] Delete failed:', e.message)
  }
}

module.exports = { uploadBuffer, uploadBase64, uploadFile, deleteByUrl }
