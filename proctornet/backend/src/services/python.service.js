const axios = require('axios')

const PYTHON_API_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001'

async function compareFaces(facePhotoUrl, idCardPhotoUrl) {
  try {
    const response = await axios.post(`${PYTHON_API_URL}/api/face/compare`, {
      facePhotoUrl,
      idCardPhotoUrl
    }, { timeout: 30000 })
    return response.data
  } catch (error) {
    console.error('[python.service - compareFaces]', error.message)
    throw new Error('Failed to communicate with AI Face Verification service.')
  }
}

async function verifyLiveFace(liveFrameBase64, registeredPhotoUrl) {
  try {
    const response = await axios.post(`${PYTHON_API_URL}/api/face/verify-live`, {
      liveFrameBase64,
      registeredPhotoUrl
    }, { timeout: 15000 })
    return response.data
  } catch (error) {
    console.error('[python.service - verifyLiveFace]', error.message)
    throw new Error('Failed to verify live face.')
  }
}

async function verifyIdCardOcr(idCardUrl) {
  try {
    const response = await axios.post(`${PYTHON_API_URL}/api/ocr/verify-id`, {
      idCardUrl
    }, { timeout: 20000 })
    return response.data
  } catch (error) {
    console.error('[python.service - verifyIdCardOcr]', error.message)
    throw new Error('Failed to extract OCR data from ID card.')
  }
}

module.exports = {
  compareFaces,
  verifyLiveFace,
  verifyIdCardOcr
}
