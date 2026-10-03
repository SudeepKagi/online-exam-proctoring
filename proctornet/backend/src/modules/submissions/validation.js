const { z } = require('zod')

const attemptIdParamSchema = z.object({
  attemptId: z.string().uuid('Invalid attempt ID format')
}).strict()

const submitHeadersSchema = z.object({
  'idempotency-key': z.string().uuid('Idempotency-Key header must be a valid UUID')
}).passthrough()

const finalAnswerItemSchema = z.object({
  attemptQuestionId: z.string().uuid('Invalid question ID format'),
  optionId: z.string().uuid('Invalid option ID format').nullable(),
  revision: z.number().int().min(1)
}).strict()

const submitBodySchema = z.object({
  answers: z.array(finalAnswerItemSchema).max(100).optional().default([])
}).strict()

module.exports = {
  attemptIdParamSchema,
  submitHeadersSchema,
  submitBodySchema
}
