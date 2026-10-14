const { z } = require('zod')

const attemptIdParamSchema = z.object({
  attemptId: z.string().uuid('Invalid attempt ID format')
}).strict()

const saveAnswerParamsSchema = z.object({
  attemptId: z.string().uuid('Invalid attempt ID format'),
  attemptQuestionId: z.string().uuid('Invalid question ID format')
}).strict()

const optionIdField = z.preprocess(
  val => (val === '' ? null : val),
  z.string().uuid('Invalid option ID format').nullable().optional()
)

const saveAnswerBodySchema = z.object({
  optionId: optionIdField,
  selectedOptionId: optionIdField,
  revision: z.number().int().min(0, 'Revision must be >= 0').optional(),
  expectedRevision: z.number().int().min(0, 'Revision must be >= 0').optional(),
  clientTimestamp: z.string().optional()
}).transform(val => ({
  optionId: val.optionId ?? val.selectedOptionId ?? null,
  revision: typeof val.revision === 'number' ? val.revision : (typeof val.expectedRevision === 'number' ? val.expectedRevision : 0)
}))

const batchAnswerItemSchema = z.object({
  attemptQuestionId: z.string().uuid('Invalid question ID format'),
  optionId: optionIdField,
  selectedOptionId: optionIdField,
  revision: z.number().int().min(0, 'Revision must be >= 0').optional(),
  expectedRevision: z.number().int().min(0, 'Revision must be >= 0').optional(),
  clientTimestamp: z.string().optional()
}).transform(val => ({
  attemptQuestionId: val.attemptQuestionId,
  optionId: val.optionId ?? val.selectedOptionId ?? null,
  revision: typeof val.revision === 'number' ? val.revision : (typeof val.expectedRevision === 'number' ? val.expectedRevision : 0)
}))

const batchSaveAnswersBodySchema = z.object({
  answers: z.array(batchAnswerItemSchema).max(100, 'Maximum batch size is 100 answers').default([])
})

module.exports = {
  attemptIdParamSchema,
  saveAnswerParamsSchema,
  saveAnswerBodySchema,
  batchSaveAnswersBodySchema
}
