const { z } = require('zod')

const updateProfileSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional().nullable(),
  departmentCode: z.string().optional(),
  semester: z.number().int().min(1).max(8).optional()
}).passthrough()

const consentSchema = z.object({
  consentGiven: z.boolean().refine(val => val === true, 'Consent must be explicitly accepted')
}).passthrough()

const saveAnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOption: z.string().or(z.number()).optional().nullable(),
  clientTimestamp: z.string().optional()
}).passthrough()

const submitExamSchema = z.object({
  answers: z.record(z.any()).optional()
}).passthrough()

const createTicketSchema = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  examId: z.string().uuid().optional().nullable()
}).passthrough()

const identityVerifySchema = z.object({
  faceWithIdPhoto: z.string().min(1),
  liveFaceMatchScore: z.number().min(0).max(1).default(0.95),
  idCardOcrUsn: z.string().optional().nullable(),
  idCardMatchResult: z.boolean().default(true)
}).passthrough()

module.exports = {
  updateProfileSchema,
  consentSchema,
  saveAnswerSchema,
  submitExamSchema,
  createTicketSchema,
  identityVerifySchema
}
