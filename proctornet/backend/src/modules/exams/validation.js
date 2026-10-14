const { z } = require('zod')

const isoDatetime = z
  .string()
  .refine(
    val => {
      const d = new Date(val)
      return !isNaN(d.getTime())
    },
    { message: 'Invalid ISO datetime' }
  )
  .transform(val => new Date(val).toISOString())

const examIdParamSchema = z
  .object({
    examId: z.string().uuid('Invalid exam ID format'),
  })
  .strict()

const createExamSchema = z
  .object({
    title: z.string().min(1).max(255),
    subject: z.string().min(1).max(128),
    description: z.string().max(2000).optional().nullable(),
    startTime: isoDatetime,
    endTime: isoDatetime,
    duration: z.number().int().min(5).max(360),
    totalMarks: z.number().min(1).default(100),
    negativeMarking: z.boolean().default(false),
    negativeValue: z.number().min(0).default(0),
    questionsPerStudent: z.number().int().min(0).default(0),
    randomiseQuestions: z.boolean().default(true),
    randomiseOptions: z.boolean().default(true),
    allowedDepartments: z.array(z.string().max(16)).default([]),
    allowedSemesters: z.array(z.number().int().min(1).max(8)).default([]),
    cameraRequired: z.boolean().default(true),
    micRequired: z.boolean().default(false),
    browserLock: z.boolean().default(true),
    fullScreenMode: z.boolean().default(true),
    watermarkRequired: z.boolean().default(true),
    tabSwitchLimit: z.number().int().min(0).max(20).default(3),
  })
  .strict()

const updateExamSchema = createExamSchema.partial()

const invigilatorExamSettingsSchema = z
  .object({
    startTime: isoDatetime.optional(),
    endTime: isoDatetime.optional(),
    duration: z.number().int().min(1).max(480).optional(),
    cameraRequired: z.boolean().optional(),
    micRequired: z.boolean().optional(),
    browserLock: z.boolean().optional(),
    fullScreenMode: z.boolean().optional(),
    watermarkRequired: z.boolean().optional(),
    tabSwitchLimit: z.number().int().min(0).max(50).optional(),
    aiReverifyInterval: z.number().int().min(5).max(120).optional(),
    deviceAgentPolicy: z.enum(['REQUIRED', 'OPTIONAL', 'OFF']).optional(),
    vpnRequired: z.boolean().optional(),
  })
  .strict()

module.exports = {
  examIdParamSchema,
  createExamSchema,
  updateExamSchema,
  invigilatorExamSettingsSchema,
}
