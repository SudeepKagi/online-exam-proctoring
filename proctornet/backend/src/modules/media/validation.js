const { z } = require('zod')

const ALLOWED_CONTENT_TYPES = ['image/webp', 'image/jpeg', 'image/png']
const ALLOWED_PURPOSES = [
  'IDENTITY_PHOTO',
  'ID_CARD',
  'EVIDENCE',
  'QUESTION_IMAGE',
  'evidence',
  'identity',
  'profile'
]

const presignUploadSchema = z.object({
  purpose: z.enum(ALLOWED_PURPOSES),
  attemptId: z.string().uuid('Invalid attempt ID format').optional(),
  examId: z.string().uuid('Invalid exam ID format').optional(),
  contentType: z.enum(ALLOWED_CONTENT_TYPES, {
    errorMap: () => ({ message: 'Content-Type must be image/webp, image/jpeg, or image/png' })
  }),
  bytes: z.number().int().positive('Bytes must be a positive integer').max(2 * 1024 * 1024, 'Maximum upload size is 2MB')
}).strict()

const completeUploadSchema = z.object({
  key: z.string().min(5).max(512),
  purpose: z.enum(ALLOWED_PURPOSES),
  attemptId: z.string().uuid().optional(),
  examId: z.string().uuid().optional(),
  eventType: z.string().optional().default('SNAPSHOT'),
  clientTimestamp: z.string().optional()
}).strict()

module.exports = {
  ALLOWED_CONTENT_TYPES,
  ALLOWED_PURPOSES,
  presignUploadSchema,
  completeUploadSchema
}
