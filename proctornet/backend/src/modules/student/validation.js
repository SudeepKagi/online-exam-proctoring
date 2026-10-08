const { z } = require('zod')

const updateProfileSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional().nullable()
}).passthrough()

const consentSchema = z.object({
  consentGiven: z.boolean().refine(val => val === true, 'Consent must be explicitly accepted')
}).passthrough()

const createTicketSchema = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  examId: z.string().uuid().optional().nullable()
}).passthrough()

const identityVerifySchema = z.object({
  faceWithIdPhoto: z.string().min(1),
  liveFaceMatchScore: z.number().min(0).max(1).optional(),
  idCardOcrUsn: z.string().optional().nullable(),
  idCardMatchResult: z.boolean().optional()
}).passthrough()

module.exports = {
  updateProfileSchema,
  consentSchema,
  createTicketSchema,
  identityVerifySchema
}
