const { z } = require('zod')

const attemptIdParamSchema = z.object({
  attemptId: z.string().uuid('Invalid attempt ID format')
}).strict()

const submitHeadersSchema = z.object({
  'idempotency-key': z.string().min(1, 'Idempotency-Key header is required').max(255)
}).passthrough()

const finalAnswerItemSchema = z.object({
  attemptQuestionId: z.string().uuid('Invalid question ID format'),
  optionId: z.string().uuid('Invalid option ID format').nullable().optional(),
  selectedOptionId: z.string().uuid('Invalid option ID format').nullable().optional(),
  revision: z.number().int().min(0).optional(),
  expectedRevision: z.number().int().min(0).optional(),
  clientTimestamp: z.string().optional()
}).transform(val => ({
  attemptQuestionId: val.attemptQuestionId,
  optionId: val.optionId ?? val.selectedOptionId ?? null,
  revision: typeof val.revision === 'number' ? val.revision : (typeof val.expectedRevision === 'number' ? val.expectedRevision : 0)
}))

const submitBodySchema = z.object({
  answers: z.array(finalAnswerItemSchema).max(100).optional().default([])
})

module.exports = {
  attemptIdParamSchema,
  submitHeadersSchema,
  submitBodySchema
}
