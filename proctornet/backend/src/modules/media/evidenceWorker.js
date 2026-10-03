const sharp = require('sharp')
const { rabbitmq } = require('../../infra/rabbitmq/client')
const { prisma } = require('../../infra/postgres/client')
const {
  headObject,
  getObjectBuffer,
  putObject,
  buildThumbKey
} = require('../../infra/s3/s3.client')
const { logger } = require('../../shared/logging')

// Limit sharp internal thread concurrency as specified in Notion 13.10
sharp.concurrency(2)

function isValidMagicBytes(buf) {
  if (!buf || buf.length < 12) return false
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  const isPng =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  const isWebp =
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  return isJpeg || isPng || isWebp
}

class EvidenceWorker {
  constructor() {
    this.consumerTag = null
    this.isStarted = false
  }

  async start() {
    if (this.isStarted) return
    this.isStarted = true

    logger.info('Starting EvidenceWorker for asynchronous thumbnail generation and validation')

    try {
      this.consumerTag = await rabbitmq.consume('evidence', async (event, msg) => {
        await this.processEvent(event)
      })
    } catch (err) {
      logger.warn({ error: err.message }, 'Could not immediately start RabbitMQ evidence consumer; will retry')
    }
  }

  async stop() {
    this.isStarted = false
    this.consumerTag = null
  }

  /**
   * Process a single evidence.uploaded event idempotently
   */
  async processEvent(event) {
    const payload = event.payload || event
    const eventId = event.eventId || payload.eventId
    const attemptId = payload.attemptId
    const examId = payload.examId || 'unknown'
    const evidenceKey = payload.evidenceKey

    if (!evidenceKey) {
      logger.warn({ event }, 'EvidenceWorker received event without evidenceKey')
      return
    }

    logger.info({ eventId, attemptId, evidenceKey }, 'Processing uploaded evidence asset')

    // 1. Idempotency Check: if violation is already UPLOADED, skip
    let violation = null
    if (eventId) {
      try {
        violation = await prisma.violationEvent.findUnique({
          where: { id: BigInt(eventId) }
        })
      } catch (err) {
        logger.warn({ eventId, error: err.message }, 'Error finding violationEvent by ID')
      }
    }

    if (!violation && attemptId && evidenceKey) {
      violation = await prisma.violationEvent.findFirst({
        where: { attemptId, evidenceKey }
      })
    }

    if (violation && violation.evidenceStatus === 'UPLOADED' && violation.thumbKey) {
      logger.info({ eventId, evidenceKey }, 'Evidence already processed and UPLOADED, skipping duplicate')
      return { status: 'ALREADY_PROCESSED', thumbKey: violation.thumbKey }
    }

    // 2. S3 HeadObject Verification (Existence & Size limit <= 300 KB)
    let head
    try {
      head = await headObject(evidenceKey)
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        logger.error({ evidenceKey }, 'Evidence object not found on S3')
        if (violation) {
          await prisma.violationEvent.update({
            where: { id: violation.id },
            data: { evidenceStatus: 'FAILED' }
          })
        }
        return { status: 'FAILED', reason: 'OBJECT_NOT_FOUND' }
      }
      throw err // Transient S3 error, trigger RabbitMQ retry
    }

    if (head.ContentLength > 300 * 1024) {
      logger.error({ size: head.ContentLength, evidenceKey }, 'Evidence object exceeds 300 KB cap')
      if (violation) {
        await prisma.violationEvent.update({
          where: { id: violation.id },
          data: { evidenceStatus: 'FAILED' }
        })
      }
      return { status: 'FAILED', reason: 'OVERSIZED' }
    }

    // 3. Download Buffer & Validate Magic Bytes
    const buffer = await getObjectBuffer(evidenceKey)

    if (!isValidMagicBytes(buffer)) {
      logger.error({ evidenceKey }, 'Evidence object failed magic byte validation (not valid image)')
      if (violation) {
        await prisma.violationEvent.update({
          where: { id: violation.id },
          data: { evidenceStatus: 'FAILED' }
        })
      }
      return { status: 'FAILED', reason: 'INVALID_MAGIC_BYTES' }
    }

    // 4. Decode with Sharp, Limit Pixels, Generate 320px WebP Thumbnail
    try {
      const image = sharp(buffer, { failOn: 'error' })
      const metadata = await image.metadata()

      // Input pixel limit
      if (metadata.width && metadata.height && metadata.width * metadata.height > 1920 * 1080) {
        logger.error({ width: metadata.width, height: metadata.height }, 'Image exceeds max pixel resolution limit')
        if (violation) {
          await prisma.violationEvent.update({
            where: { id: violation.id },
            data: { evidenceStatus: 'FAILED' }
          })
        }
        return { status: 'FAILED', reason: 'RESOLUTION_EXCEEDED' }
      }

      // Generate 320 px wide WebP thumbnail
      const thumbBuffer = await sharp(buffer)
        .resize({ width: 320, withoutEnlargement: true })
        .webp({ quality: 60 })
        .toBuffer()

      // 5. Upload Thumbnail to S3
      const thumbKey = buildThumbKey(examId, attemptId)
      await putObject(thumbKey, thumbBuffer, 'image/webp')

      // 6. Update Violation Record
      if (violation) {
        await prisma.violationEvent.update({
          where: { id: violation.id },
          data: {
            evidenceStatus: 'UPLOADED',
            thumbKey
          }
        })
      }

      logger.info({ eventId, evidenceKey, thumbKey }, 'Evidence successfully validated and thumbnail created')
      return { status: 'UPLOADED', thumbKey }
    } catch (err) {
      // Decode or corruption error
      logger.error({ error: err.message, evidenceKey }, 'Sharp image decoding failed on evidence asset')
      if (violation) {
        await prisma.violationEvent.update({
          where: { id: violation.id },
          data: { evidenceStatus: 'FAILED' }
        })
      }
      // Return FAILED, do not rethrow corrupt image error (kills poisoning, preserves violation row)
      return { status: 'FAILED', reason: 'DECODE_ERROR', error: err.message }
    }
  }
}

module.exports = {
  EvidenceWorker,
  evidenceWorker: new EvidenceWorker(),
  isValidMagicBytes
}
