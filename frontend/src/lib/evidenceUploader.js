/**
 * evidenceUploader.js
 * Client-Side Evidence Capture, Compression & Direct S3 Upload Pipeline (R2)
 *
 * Implements:
 * 1. POST /api/v1/attempts/:id/violations -> { violationId, evidenceTickets: { camera, screen } }
 * 2. Client captures camera + screen frame (canvas / ImageCapture)
 * 3. Compresses in Web Worker (<= 120 KB, <= 1280x720, WebP)
 * 4. Client-made 320 px thumbnail (<= 50 KB, WebP) - avoids server transcoding
 * 5. Direct-to-S3 upload via presigned tickets
 * 6. POST /violations/:id/evidence/complete with exponential backoff retry
 */

import api from '@/utils/api'
import { compressInWorker, createThumbnail, captureFrameFromSource } from './imageCompress'

/**
 * Upload a binary blob directly to S3 using presigned PUT URL
 */
async function uploadToS3(ticket, blob) {
  if (!ticket || !blob) return false

  const putUrl = ticket.putUrl || ticket.url
  if (!putUrl) return false

  const contentType = ticket.contentType || blob.type || 'image/webp'
  const response = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType
    },
    body: blob
  })

  if (!response.ok) {
    throw new Error(`S3 upload failed with HTTP status ${response.status}: ${response.statusText}`)
  }

  return true
}

/**
 * Complete evidence upload on server with retry backoff
 */
async function completeEvidenceWithRetry(violationId, keys, maxRetries = 3) {
  let delay = 1000
  let lastError = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await api.post(`/violations/${violationId}/evidence/complete`, keys)
      return res.data
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delay))
        delay *= 2
      }
    }
  }

  console.warn(`[EvidenceUploader] Evidence completion retry exhausted for violation ${violationId}:`, lastError?.message)
  return null
}

/**
 * Orchestrate complete violation reporting, direct S3 upload, and completion handshake
 */
export async function reportViolationWithEvidence({
  attemptId,
  eventType,
  metadata = {},
  videoElement = null,
  screenElement = null,
  videoTrack = null,
  screenTrack = null
}) {
  if (!attemptId || !eventType) return null

  try {
    // 1. Record violation and obtain tickets issued AFTER row exists
    const res = await api.post(`/attempts/${attemptId}/violations`, {
      eventType,
      metadata,
      clientTimestamp: new Date().toISOString()
    })

    const data = res.data
    if (!data || !data.recorded) {
      return data // Cooldown suppressed
    }

    const { violationId, evidenceTickets } = data
    if (!evidenceTickets || !violationId) {
      return data
    }

    const completionKeys = {}

    // 2. Process camera frame
    if (evidenceTickets.camera) {
      const cameraSource = videoElement || videoTrack
      const frameBitmap = await captureFrameFromSource(cameraSource)

      if (frameBitmap) {
        // Compress in Web Worker (<= 120 KB, <= 1280x720)
        const compressed = await compressInWorker(frameBitmap, {
          maxWidth: 1280,
          maxHeight: 720,
          targetBytes: 120 * 1024
        })

        // Client-made 320 px thumbnail
        const thumb = await createThumbnail(frameBitmap, 320)

        // Upload both directly to S3
        await uploadToS3(evidenceTickets.camera, compressed.blob)
        if (evidenceTickets.camera.thumbPutUrl || evidenceTickets.camera.thumbUrl) {
          await uploadToS3({
            putUrl: evidenceTickets.camera.thumbPutUrl || evidenceTickets.camera.thumbUrl,
            contentType: 'image/webp'
          }, thumb.blob)
        }

        completionKeys.cameraKey = evidenceTickets.camera.key
        completionKeys.thumbKey = evidenceTickets.camera.thumbKey
      }
    }

    // 3. Process screen frame
    if (evidenceTickets.screen) {
      const screenSource = screenElement || screenTrack
      const screenBitmap = await captureFrameFromSource(screenSource)

      if (screenBitmap) {
        const compressedScreen = await compressInWorker(screenBitmap, {
          maxWidth: 1280,
          maxHeight: 720,
          targetBytes: 120 * 1024
        })

        const screenThumb = await createThumbnail(screenBitmap, 320)

        await uploadToS3(evidenceTickets.screen, compressedScreen.blob)
        if (evidenceTickets.screen.thumbPutUrl || evidenceTickets.screen.thumbUrl) {
          await uploadToS3({
            putUrl: evidenceTickets.screen.thumbPutUrl || evidenceTickets.screen.thumbUrl,
            contentType: 'image/webp'
          }, screenThumb.blob)
        }

        completionKeys.screenKey = evidenceTickets.screen.key
        completionKeys.screenThumbKey = evidenceTickets.screen.thumbKey
      }
    }

    // 4. Complete upload on backend if any frames were sent
    if (completionKeys.cameraKey || completionKeys.screenKey) {
      await completeEvidenceWithRetry(violationId, completionKeys)
    }

    return {
      recorded: true,
      violationId,
      evidenceStatus: completionKeys.cameraKey ? 'UPLOADED' : 'PENDING',
      evidenceKeys: completionKeys
    }
  } catch (err) {
    console.warn(`[EvidenceUploader] Error during evidence capture and upload for ${eventType}:`, err.message)
    return null
  }
}
