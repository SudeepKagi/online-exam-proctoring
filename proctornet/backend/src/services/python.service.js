const axios = require('axios')

const PYTHON_API_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001'

async function cropIdFace(idCardPhotoUrl) {
  try {
    const response = await axios.post(`${PYTHON_API_URL}/api/face/crop-id-face`, {
      idCardPhotoUrl
    }, { timeout: 20000 })
    return response.data
  } catch (error) {
    console.error('[python.service - cropIdFace Error]', error.message)
    return { success: false, croppedFaceBase64: idCardPhotoUrl, error: error.message }
  }
}

async function checkLiveness(image) {
  try {
    const response = await axios.post(`${PYTHON_API_URL}/api/face/liveness-check`, {
      image
    }, { timeout: 15000 })
    return response.data
  } catch (error) {
    console.error('[python.service - checkLiveness Error]', error.message)
    return {
      isReal: false,
      livenessScore: 0.0,
      error: 'LIVENESS_SERVICE_UNAVAILABLE',
      message: 'Liveness check service is currently unavailable.'
    }
  }
}

async function verifyIdCardOcr(idCardUrl) {
  try {
    const response = await axios.post(`${PYTHON_API_URL}/api/ocr/verify-id`, {
      idCardUrl
    }, { timeout: 25000 })
    return response.data
  } catch (error) {
    console.error('[python.service - verifyIdCardOcr Error]', error.message)
    return {
      isValid: false,
      extractedUsn: null,
      extractedName: null,
      error: 'Failed to extract OCR data from ID card.'
    }
  }
}

/**
 * Generate AI questions dynamically via Python service
 */
async function generateAIQuestions({ topic, difficulty, count, type }) {
  try {
    const response = await axios.post(`${PYTHON_API_URL}/api/ai/generate-questions`, {
      topic, difficulty, count, type
    }, { timeout: 25000 })
    return response.data
  } catch (error) {
    console.error('[python.service - generateAIQuestions Error]', error.message)
    return { success: false, error: error.message, questions: [] }
  }
}

module.exports = {
  cropIdFace,
  checkLiveness,
  verifyIdCardOcr,
  generateAIQuestions,
}

