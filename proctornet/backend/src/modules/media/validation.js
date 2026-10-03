const { z } = require('zod')

const presignUploadSchema = z.object({
  attemptId: z.string().uuid('Invalid attempt ID format'),
  contentType: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/webm',
    'video/mp4',
    'application/pdf'
  ]),
  purpose: z.string().max(64).optional().default('evidence')
}).strict()

module.exports = {
  presignUploadSchema
}
