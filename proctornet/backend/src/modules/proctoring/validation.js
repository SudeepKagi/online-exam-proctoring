const { z } = require('zod')

const attemptIdParamSchema = z.object({
  attemptId: z.string().uuid('Invalid attempt ID format')
}).strict()

const examIdParamSchema = z.object({
  examId: z.string().uuid('Invalid exam ID format')
}).strict()

const recordViolationSchema = z.object({
  eventType: z.enum([
    'TAB_SWITCH',
    'FULLSCREEN_EXIT',
    'MULTIPLE_FACES',
    'NO_FACE',
    'FACE_MISMATCH',
    'AUDIO_DETECTED',
    'VOICE_DETECTED',
    'SUSPICIOUS_OBJECT',
    'DEVTOOLS_OPENED',
    'KEYBOARD_SHORTCUT',
    'WINDOW_BLUR',
    'IP_CHANGE',
    'VM_DETECTED',
    'SCREEN_SHARE_STOPPED'
  ]),
  metadata: z.record(z.any()).optional().default({}).refine(
    (val) => !val || JSON.stringify(val).length <= 2048,
    'Metadata payload exceeds 2KB size cap'
  ),
  clientTimestamp: z.union([z.string(), z.number()]).optional()
}).strict()

const liveKitTokenSchema = z.object({
  examId: z.string().uuid('Invalid exam ID format'),
  attemptId: z.string().uuid('Invalid attempt ID format').optional()
}).passthrough()

const postChatMessageSchema = z.object({
  message: z.string().min(1).max(500, 'Message cannot exceed 500 characters'),
  studentId: z.string().uuid('Invalid student ID format').optional()
}).strict()

const rosterQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
  status: z.enum(['READY', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'SUBMITTED', 'TERMINATED', 'EXPIRED']).optional(),
  q: z.string().max(100).optional()
}).passthrough()

const violationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  type: z.enum([
    'TAB_SWITCH',
    'FULLSCREEN_EXIT',
    'MULTIPLE_FACES',
    'NO_FACE',
    'FACE_MISMATCH',
    'AUDIO_DETECTED',
    'VOICE_DETECTED',
    'SUSPICIOUS_OBJECT',
    'DEVTOOLS_OPENED',
    'KEYBOARD_SHORTCUT',
    'WINDOW_BLUR',
    'IP_CHANGE',
    'VM_DETECTED',
    'SCREEN_SHARE_STOPPED'
  ]).optional()
}).passthrough()

const warnCandidateSchema = z.object({
  message: z.string().min(1).max(500)
}).strict()

const actionReasonSchema = z.object({
  reason: z.string().max(500).optional()
}).passthrough()

module.exports = {
  attemptIdParamSchema,
  examIdParamSchema,
  recordViolationSchema,
  liveKitTokenSchema,
  postChatMessageSchema,
  rosterQuerySchema,
  violationsQuerySchema,
  warnCandidateSchema,
  actionReasonSchema
}

