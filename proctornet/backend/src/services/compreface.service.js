const axios = require('axios')
const FormData = require('form-data')

const COMPREFACE_URL = process.env.COMPREFACE_URL || 'http://localhost:8000'
const COMPREFACE_API_KEY = process.env.COMPREFACE_API_KEY || '00000000-0000-0000-0000-000000000000' // Recognition API key

/**
 * Helper to turn URL or Data-URI/Base64 into a Buffer + filename for Form-Data
 */
async function getImageBuffer(imageInput) {
  if (Buffer.isBuffer(imageInput)) {
    return { buffer: imageInput, filename: 'image.jpg' }
  }

  if (typeof imageInput === 'string') {
    if (imageInput.startsWith('data:image')) {
      const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      return { buffer, filename: 'image.jpg' }
    } else if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      const response = await axios.get(imageInput, { responseType: 'arraybuffer' })
      return { buffer: Buffer.from(response.data), filename: 'image.jpg' }
    }
  }

  throw new Error('Invalid image input format. Must be Buffer, Data URI, or HTTP URL.')
}

/**
 * Add a face image for a subject in CompreFace
 * Endpoint: POST /api/v1/recognition/faces?subject={subjectName}
 */
async function addFaceToSubject(subjectName, imageInput) {
  try {
    const { buffer, filename } = await getImageBuffer(imageInput)
    const formData = new FormData()
    formData.append('file', buffer, filename)

    const response = await axios.post(
      `${COMPREFACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectName)}`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'x-api-key': COMPREFACE_API_KEY,
        },
        timeout: 15000,
      }
    )

    return {
      success: true,
      image_id: response.data?.image_id,
      subject: response.data?.subject,
    }
  } catch (error) {
    console.error('[compreface.service - addFaceToSubject Error]', error.response?.data || error.message)
    // Return mock success if CompreFace server is offline in dev environment
    if (process.env.NODE_ENV !== 'production' && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
      console.warn('[CompreFace Warning] CompreFace service unreachable. Using fallback reference ID.')
      return { success: true, image_id: `mock-face-${Date.now()}`, subject: subjectName, mock: true }
    }
    throw new Error('Failed to enroll face in CompreFace: ' + (error.response?.data?.message || error.message))
  }
}

/**
 * Recognize live face against subject embeddings in CompreFace
 * Endpoint: POST /api/v1/recognition/recognize?limit=1&prediction_count=1
 */
async function recognizeFace(imageInput, expectedSubject = null) {
  try {
    const { buffer, filename } = await getImageBuffer(imageInput)
    const formData = new FormData()
    formData.append('file', buffer, filename)

    const response = await axios.post(
      `${COMPREFACE_URL}/api/v1/recognition/recognize?limit=1&prediction_count=1`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'x-api-key': COMPREFACE_API_KEY,
        },
        timeout: 15000,
      }
    )

    const results = response.data?.result || []
    if (results.length === 0 || !results[0].subjects || results[0].subjects.length === 0) {
      return {
        matched: false,
        similarity: 0.0,
        subject: null,
        message: 'No face detected or no matching subject found.',
      }
    }

    const topMatch = results[0].subjects[0]
    const similarity = parseFloat(topMatch.similarity) || 0.0
    const matchedSubject = topMatch.subject

    const isExpectedMatch = expectedSubject ? matchedSubject === expectedSubject : true

    return {
      matched: isExpectedMatch && similarity >= 0.65,
      similarity,
      subject: matchedSubject,
      box: results[0].box,
    }
  } catch (error) {
    console.error('[compreface.service - recognizeFace Error]', error.response?.data || error.message)
    // Return dev fallback if CompreFace server is offline
    if (process.env.NODE_ENV !== 'production' && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
      console.warn('[CompreFace Warning] CompreFace service unreachable. Using fallback recognition score 0.92.')
      return { matched: true, similarity: 0.92, subject: expectedSubject || 'mock-student', mock: true }
    }
    throw new Error('Failed to process face recognition: ' + (error.response?.data?.message || error.message))
  }
}

/**
 * Delete all face records for a subject from CompreFace
 */
async function deleteSubjectFaces(subjectName) {
  try {
    const response = await axios.delete(
      `${COMPREFACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectName)}`,
      {
        headers: { 'x-api-key': COMPREFACE_API_KEY },
        timeout: 10000,
      }
    )
    return { success: true, count: response.data?.deleted || 0 }
  } catch (error) {
    console.error('[compreface.service - deleteSubjectFaces Error]', error.message)
    return { success: false, error: error.message }
  }
}

module.exports = {
  addFaceToSubject,
  recognizeFace,
  deleteSubjectFaces,
}
