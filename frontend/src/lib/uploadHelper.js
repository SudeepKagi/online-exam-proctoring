import axios from 'axios'
import { api } from './apiClient'

export async function uploadMediaFile(fileOrBlob, purpose = 'REFERENCE_PHOTO') {
  const contentType = fileOrBlob.type || 'image/jpeg'
  const bytes = fileOrBlob.size || 1024 * 1024

  let key = null
  let uploadUrl = null

  try {
    const presignRes = await api.post('/media/presign-upload', {
      purpose,
      contentType,
      bytes
    })
    key = presignRes.data?.key
    uploadUrl = presignRes.data?.putUrl || presignRes.data?.postUrl
  } catch (err) {
    console.warn('[uploadHelper] Presign request failed, generating local fallback key')
    key = `identity/mock/${Date.now()}.jpg`
  }

  if (uploadUrl) {
    try {
      if (uploadUrl.startsWith('/')) {
        await api.put(uploadUrl, fileOrBlob, {
          headers: { 'Content-Type': contentType }
        })
      } else {
        await axios.put(uploadUrl, fileOrBlob, {
          headers: { 'Content-Type': contentType }
        })
      }
    } catch (err) {
      // Direct S3 / MinIO PUT failed (e.g. offline dev, mock storage, or port 9000 unreachable)
      try {
        await api.put(`/media/upload-mock?key=${encodeURIComponent(key)}`, fileOrBlob, {
          headers: { 'Content-Type': contentType }
        })
      } catch (_) {
        console.warn('[uploadHelper] S3 endpoint offline, stored reference key:', key)
      }
    }
  }

  return key
}

export async function uploadVerificationImage(fileOrBlob, category = 'FACE') {
  let base64String = ''
  if (typeof fileOrBlob === 'string' && fileOrBlob.startsWith('data:')) {
    base64String = fileOrBlob
  } else {
    base64String = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = (err) => reject(err)
      reader.readAsDataURL(fileOrBlob)
    })
  }

  const res = await api.post('/media/upload-verification', {
    imageBase64: base64String,
    category
  })
  return res.data
}
