const { z } = require('zod')

const attemptIdParamSchema = z.object({
  attemptId: z.string().uuid('Invalid attempt ID format')
}).strict()

const examIdParamSchema = z.object({
  examId: z.string().uuid('Invalid exam ID format')
}).strict()

const transitionStateSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'SUBMITTED', 'TERMINATED', 'EXPIRED']),
  reason: z.string().max(500).optional()
}).strict()

module.exports = {
  attemptIdParamSchema,
  examIdParamSchema,
  transitionStateSchema
}
