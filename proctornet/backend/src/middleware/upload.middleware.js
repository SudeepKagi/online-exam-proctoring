const multer  = require('multer')
const path    = require('path')
const crypto  = require('crypto')

// ── Storage: local disk (uploads/) ──────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/photos'))
  },
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex')
    const ext    = path.extname(file.originalname).toLowerCase()
    cb(null, `${Date.now()}_${unique}${ext}`)
  },
})

// ── Memory storage (for base64 / Cloudinary direct upload) ──────
const memoryStorage = multer.memoryStorage()

// ── File filter: images only ─────────────────────────────────────
function imageFilter(req, file, cb) {
  const ALLOWED = ['.jpg', '.jpeg', '.png', '.webp']
  const ext     = path.extname(file.originalname).toLowerCase()
  if (ALLOWED.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error('Only image files are allowed (.jpg, .jpeg, .png, .webp)'), false)
  }
}

// ── Multer instances ─────────────────────────────────────────────

/** Single photo upload to disk — field name 'photo' */
const uploadPhoto = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single('photo')

/** Single photo upload to memory — for Cloudinary streaming */
const uploadPhotoMemory = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('photo')

/** Two photos (facePhoto + idCard) to memory */
const uploadTwoPhotos = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: 'facePhoto', maxCount: 1 },
  { name: 'idCard',    maxCount: 1 },
])

/** ID card upload (for invigilator login) */
const uploadIdCard = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('idCard')

/** Question image upload */
const uploadQuestionImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('image')

/** CSV import for bulk questions */
const uploadCsv = multer({
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.csv'].includes(ext)) cb(null, true)
    else cb(new Error('Only CSV files are allowed'), false)
  },
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
}).single('csv')

// ── Multer error handler wrapper ─────────────────────────────────
function handleUpload(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` })
      } else if (err) {
        return res.status(400).json({ error: err.message })
      }
      next()
    })
  }
}

module.exports = {
  uploadPhoto:        handleUpload(uploadPhoto),
  uploadPhotoMemory:  handleUpload(uploadPhotoMemory),
  uploadTwoPhotos:    handleUpload(uploadTwoPhotos),
  uploadIdCard:       handleUpload(uploadIdCard),
  uploadQuestionImage: handleUpload(uploadQuestionImage),
  uploadCsv:          handleUpload(uploadCsv),
}
