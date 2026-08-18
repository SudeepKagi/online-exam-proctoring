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
 * Run YOLOv8n object detection on a base64-encoded webcam frame.
 * Detects: multiple persons, phone, book, laptop.
 * Returns the detection result from the Python AI service.
 * Returns explicit error status on failure.
 *
 * @param {string} frameBase64 - base64 data-URI string of the webcam frame
 * @returns {Promise<Object>} detection result
 */
async function detectObjects(frameBase64) {
  try {
    const response = await axios.post(
      `${PYTHON_API_URL}/api/detect/yolo`,
      { frame: frameBase64 },
      { timeout: 10000 }  // 10s timeout — generous for CPU inference
    )
    return response.data
  } catch (error) {
    console.error('[python.service - detectObjects Error]', error.message)
    return {
      success: false,
      yolo_available: false,
      error: 'OBJECT_DETECTION_UNAVAILABLE',
      message: 'Object detection service (YOLO) is currently unreachable or unavailable.',
      detections: [],
      violations: []
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
  detectObjects,
  generateAIQuestions,
}

