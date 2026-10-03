const { z } = require('zod')

const questionIdParamSchema = z.object({
  questionId: z.string().uuid('Invalid question ID format')
}).strict()

const examIdParamSchema = z.object({
  examId: z.string().uuid('Invalid exam ID format')
}).strict()

const questionOptionInputSchema = z.object({
  text: z.string().min(1).max(500, 'Option text must be between 1 and 500 characters'),
  isCorrect: z.boolean().default(false)
}).strict()

const createQuestionSchema = z.object({
  questionText: z.string().min(1).max(5000, 'Question text must be between 1 and 5000 characters'),
  marks: z.number().positive('Marks must be greater than 0'),
  negativeMarks: z.number().min(0, 'Negative marks cannot be negative').default(0),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  imageKey: z.string().max(255).optional().nullable(),
  options: z.array(questionOptionInputSchema)
    .min(2, 'Must have at least 2 options')
    .max(6, 'Cannot exceed 6 options')
    .refine(
      opts => opts.filter(o => o.isCorrect).length === 1,
      'Exactly one option must be marked as correct'
    )
}).refine(
  data => data.negativeMarks <= data.marks,
  'Negative marks cannot exceed positive marks'
)

module.exports = {
  questionIdParamSchema,
  examIdParamSchema,
  createQuestionSchema
}
