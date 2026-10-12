const { z } = require('zod')

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  avatar: z.string().optional().nullable()
}).strict()

const consentSchema = z.object({
  consentGiven: z.boolean().refine(val => val === true, 'Consent must be explicitly accepted')
}).strict()

const createTicketSchema = z.object({
  subject: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  examId: z.string().uuid().optional().nullable()
}).strict()

const identityVerifySchema = z.object({
  faceWithIdPhoto: z.string().min(1),
  liveFaceMatchScore: z.number().min(0).max(1).optional(),
  idCardOcrUsn: z.string().optional().nullable(),
  idCardMatchResult: z.boolean().optional()
}).strict()

module.exports = {
  updateProfileSchema,
  consentSchema,
  createTicketSchema,
  identityVerifySchema
}
