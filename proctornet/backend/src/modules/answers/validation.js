const { z } = require('zod')

const attemptIdParamSchema = z.object({
  attemptId: z.string().uuid('Invalid attempt ID format')
}).strict()

const saveAnswerParamsSchema = z.object({
  attemptId: z.string().uuid('Invalid attempt ID format'),
  attemptQuestionId: z.string().uuid('Invalid question ID format')
}).strict()

const saveAnswerBodySchema = z.object({
  optionId: z.string().uuid('Invalid option ID format').nullable(),
  revision: z.number().int().min(1, 'Revision must be >= 1')
}).strict()

const batchAnswerItemSchema = z.object({
  attemptQuestionId: z.string().uuid('Invalid question ID format'),
  optionId: z.string().uuid('Invalid option ID format').nullable(),
  revision: z.number().int().min(1, 'Revision must be >= 1')
}).strict()

const batchSaveAnswersBodySchema = z.object({
  answers: z.array(batchAnswerItemSchema).min(1).max(100, 'Maximum batch size is 100 answers')
}).strict()

module.exports = {
  attemptIdParamSchema,
  saveAnswerParamsSchema,
  saveAnswerBodySchema,
  batchSaveAnswersBodySchema
}
