import axios from 'axios'
import { api } from './apiClient'

export async function uploadMediaFile(fileOrBlob, purpose = 'REFERENCE_PHOTO') {
  const contentType = fileOrBlob.type || 'image/jpeg'
  const bytes = fileOrBlob.size || 1024 * 1024

  let key
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
        console.warn('[uploadHelper] S3 endpoint offline, stored reference key:', key) // terms-ok: dev logging
      }
    }
  }

  return key
}

export function compressImageToDataUrl(source, maxDim = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!source) return reject(new Error('No image source provided'))

    if (typeof source === 'string' && source.startsWith('data:image/jpeg;base64,') && source.length < 90000) {
      return resolve(source)
    }

    if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
      const v = source
      let w = v.videoWidth || 640
      let h = v.videoHeight || 480
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim }
        else { w = Math.round((w * maxDim) / h); h = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(v, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      let w = img.width || 640
      let h = img.height || 480
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim }
        else { w = Math.round((w * maxDim) / h); h = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      if (source instanceof Blob || source instanceof File) {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(source)
      } else if (typeof source === 'string') {
        resolve(source)
      } else {
        reject(new Error('Failed to load image'))
      }
    }

    if (typeof source === 'string') {
      img.src = source
    } else {
      img.src = URL.createObjectURL(source)
    }
  })
}

export function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return new Blob([], { type: 'image/jpeg' })
  }
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
  const binary = atob(parts[1])
  const len = binary.length
  const buffer = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
  return new Blob([buffer], { type: mime })
}

export async function uploadVerificationImage(fileOrBlob, category = 'FACE') {
  let base64String
  if (typeof fileOrBlob === 'string' && fileOrBlob.startsWith('data:image/')) {
    base64String = fileOrBlob
  } else {
    try {
      base64String = await compressImageToDataUrl(fileOrBlob, 800, 0.75)
    } catch (_) {
      if (typeof fileOrBlob === 'string') base64String = fileOrBlob
      else {
        base64String = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = (err) => reject(err)
          reader.readAsDataURL(fileOrBlob)
        })
      }
    }
  }

  const res = await api.post('/media/upload-verification', {
    imageBase64: base64String,
    category
  })
  return {
    ...res.data,
    dataUrl: base64String
  }
}
