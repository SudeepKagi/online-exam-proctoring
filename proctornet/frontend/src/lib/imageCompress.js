/**
 * ProctorNet Client-Side Image Compression Pipeline (ADR-011 / Notion 13.10)
 *
 * Enforces:
 * - Max resolution: 1280x720 for evidence snapshots, 1024x1024 for profile photos
 * - Re-rasterization to strip all EXIF/GPS metadata
 * - WebP 0.6 primary, JPEG 0.7 fallback
 * - Adaptive quality loop down to 0.4 targeting <= 120 KB (hard cap 300 KB)
 * - OffscreenCanvas / Web Worker capable
 */

const DEFAULT_TARGET_BYTES = 120 * 1024 // 120 KB target
const HARD_CAP_BYTES = 300 * 1024       // 300 KB hard cap

/**
 * Calculate scaled dimensions preserving aspect ratio
 */
export function calculateDimensions(srcWidth, srcHeight, maxWidth = 1280, maxHeight = 720) {
  let width = srcWidth
  let height = srcHeight

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  return { width, height }
}

/**
 * Core pure compression function (works with ImageBitmap or Canvas)
 */
export async function compressImage(source, options = {}) {
  const {
    maxWidth = options.isProfile ? 1024 : 1280,
    maxHeight = options.isProfile ? 1024 : 720,
    targetBytes = DEFAULT_TARGET_BYTES,
    hardCapBytes = HARD_CAP_BYTES,
    initialQuality = 0.6,
    minQuality = 0.4,
    preferWebp = true
  } = options

  let bitmap
  let shouldCloseBitmap = false

  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    bitmap = source
  } else if (typeof createImageBitmap !== 'undefined') {
    bitmap = await createImageBitmap(source)
    shouldCloseBitmap = true
  } else {
    // Node.js or older browser fallback via Image element
    throw new Error('ImageBitmap / createImageBitmap is required for image compression')
  }

  try {
    const { width, height } = calculateDimensions(bitmap.width, bitmap.height, maxWidth, maxHeight)

    let canvas
    let ctx

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height)
      ctx = canvas.getContext('2d')
    } else if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      ctx = canvas.getContext('2d')
    } else {
      throw new Error('Canvas rendering context unavailable')
    }

    // Draw image onto canvas (automatically strips all EXIF/IPTC metadata)
    ctx.drawImage(bitmap, 0, 0, width, height)

    // Check WebP support and select mime type
    let mimeType = preferWebp ? 'image/webp' : 'image/jpeg'
    let quality = initialQuality

    async function exportBlob(type, q) {
      if (typeof canvas.convertToBlob === 'function') {
        return await canvas.convertToBlob({ type, quality: q })
      }
      return new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), type, q)
      })
    }

    let blob = await exportBlob(mimeType, quality)

    // Fallback to JPEG if WebP produced an empty or invalid blob
    if (!blob || blob.type !== 'image/webp') {
      mimeType = 'image/jpeg'
      quality = 0.7
      blob = await exportBlob(mimeType, quality)
    }

    // Adaptive quality degradation loop to meet the 120 KB budget
    while (blob.size > targetBytes && quality > minQuality) {
      quality = Math.max(minQuality, Math.round((quality - 0.05) * 100) / 100)
      const smallerBlob = await exportBlob(mimeType, quality)
      if (smallerBlob && smallerBlob.size < blob.size) {
        blob = smallerBlob
      }
      if (quality <= minQuality) break
    }

    if (blob.size > hardCapBytes) {
      // Further resize canvas resolution down by 20% if still exceeding hard cap
      const fallbackWidth = Math.round(width * 0.8)
      const fallbackHeight = Math.round(height * 0.8)

      let fallbackCanvas
      let fallbackCtx

      if (typeof OffscreenCanvas !== 'undefined') {
        fallbackCanvas = new OffscreenCanvas(fallbackWidth, fallbackHeight)
        fallbackCtx = fallbackCanvas.getContext('2d')
      } else {
        fallbackCanvas = document.createElement('canvas')
        fallbackCanvas.width = fallbackWidth
        fallbackCanvas.height = fallbackHeight
        fallbackCtx = fallbackCanvas.getContext('2d')
      }

      fallbackCtx.drawImage(canvas, 0, 0, fallbackWidth, fallbackHeight)

      if (typeof fallbackCanvas.convertToBlob === 'function') {
        blob = await fallbackCanvas.convertToBlob({ type: mimeType, quality: minQuality })
      } else {
        blob = await new Promise((resolve) => {
          fallbackCanvas.toBlob((b) => resolve(b), mimeType, minQuality)
        })
      }
    }

    return {
      blob,
      width,
      height,
      sizeBytes: blob.size,
      format: mimeType,
      quality
    }
  } finally {
    if (shouldCloseBitmap && bitmap && typeof bitmap.close === 'function') {
      bitmap.close()
    }
  }
}

/**
 * Worker script code for background thread compression
 */
const WORKER_CODE = `
  self.onmessage = async (e) => {
    const { id, bitmap, options } = e.data
    try {
      const { maxWidth = 1280, maxHeight = 720, targetBytes = 122880, minQuality = 0.4 } = options || {}
      
      let width = bitmap.width
      let height = bitmap.height
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0, width, height)
      bitmap.close()

      let quality = options.initialQuality || 0.6
      let blob = await canvas.convertToBlob({ type: 'image/webp', quality })

      while (blob.size > targetBytes && quality > minQuality) {
        quality = Math.max(minQuality, quality - 0.05)
        blob = await canvas.convertToBlob({ type: 'image/webp', quality })
      }

      const buffer = await blob.arrayBuffer()
      self.postMessage({ id, success: true, buffer, sizeBytes: blob.size, type: blob.type, width, height }, [buffer])
    } catch (err) {
      self.postMessage({ id, success: false, error: err.message })
    }
  }
`

let workerInstance = null

function getCompressionWorker() {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return null
  }
  if (!workerInstance) {
    try {
      const blob = new Blob([WORKER_CODE], { type: 'application/javascript' })
      const workerUrl = URL.createObjectURL(blob)
      workerInstance = new Worker(workerUrl)
    } catch {
      workerInstance = null
    }
  }
  return workerInstance
}

/**
 * Compress an image in a dedicated background Web Worker
 */
export async function compressInWorker(blobOrFile, options = {}) {
  const worker = getCompressionWorker()
  if (!worker || typeof createImageBitmap === 'undefined') {
    // Fall back to main thread compression
    return await compressImage(blobOrFile, options)
  }

  const bitmap = await createImageBitmap(blobOrFile)
  const id = Math.random().toString(36).substring(2)

  return new Promise((resolve, reject) => {
    const handler = (e) => {
      if (e.data.id === id) {
        worker.removeEventListener('message', handler)
        if (e.data.success) {
          const blob = new Blob([e.data.buffer], { type: e.data.type })
          resolve({
            blob,
            width: e.data.width,
            height: e.data.height,
            sizeBytes: e.data.sizeBytes,
            format: e.data.type
          })
        } else {
          // Fallback to inline on worker error
          compressImage(blobOrFile, options).then(resolve).catch(reject)
        }
      }
    }

    worker.addEventListener('message', handler)
    worker.postMessage({ id, bitmap, options }, [bitmap])
  })
}

/**
 * Create a client-side thumbnail (320px max dimension, WebP <= 50 KB)
 * Avoids server-side image processing on the small EC2 box (R2)
 */
export async function createThumbnail(source, maxDimension = 320) {
  return await compressImage(source, {
    maxWidth: maxDimension,
    maxHeight: maxDimension,
    targetBytes: 50 * 1024,
    hardCapBytes: 100 * 1024,
    initialQuality: 0.6,
    minQuality: 0.3
  })
}

/**
 * Capture frame from video element or media stream track
 */
export async function captureFrameFromSource(source) {
  if (!source) return null

  // If source is a MediaStreamTrack
  if (typeof MediaStreamTrack !== 'undefined' && source instanceof MediaStreamTrack) {
    if (typeof ImageCapture !== 'undefined') {
      try {
        const imageCapture = new ImageCapture(source)
        return await imageCapture.grabFrame() // returns ImageBitmap
      } catch {
        // fallback
      }
    }
  }

  // If source is an HTMLVideoElement
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    const width = source.videoWidth || 640
    const height = source.videoHeight || 480
    if (width === 0 || height === 0) return null

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(source, 0, 0, width, height)
      return await createImageBitmap(canvas)
    } else if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(source, 0, 0, width, height)
      return await createImageBitmap(canvas)
    }
  }

  return null
}
