const { z } = require('zod')

const isoDatetime = z.string().refine((val) => {
  const d = new Date(val)
  return !isNaN(d.getTime())
}, { message: 'Invalid ISO datetime' }).transform((val) => new Date(val).toISOString())

const createExamSchema = z.object({
  title: z.string().min(1),
  subject: z.string().min(1),
  description: z.string().optional().nullable(),
  startTime: isoDatetime,
  endTime: isoDatetime,
  duration: z.number().int().positive().default(60),
  totalMarks: z.number().positive().default(100),
  negativeMarking: z.boolean().default(false),
  negativeValue: z.number().min(0).default(0),
  questionsPerStudent: z.number().int().min(0).default(0),
  randomiseQuestions: z.boolean().default(true),
  randomiseOptions: z.boolean().default(true),
  allowedDepartments: z.array(z.string()).default(['CSE']),
  allowedSemesters: z.array(z.number().int()).default([1]),
  cameraRequired: z.boolean().default(true),
  micRequired: z.boolean().default(false),
  browserLock: z.boolean().default(true),
  fullScreenMode: z.boolean().default(true),
  watermarkRequired: z.boolean().default(true),
  tabSwitchLimit: z.number().int().min(1).default(3),
  vpnRequired: z.boolean().default(false)
}).passthrough()

const updateExamSchema = createExamSchema.partial()

const aiGenerateSchema = z.object({
  prompt: z.string().min(1).optional(),
  topic: z.string().optional(),
  count: z.number().int().min(1).max(50).default(5),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM')
}).passthrough()

module.exports = {
  createExamSchema,
  updateExamSchema,
  aiGenerateSchema
}
