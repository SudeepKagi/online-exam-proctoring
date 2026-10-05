const { z } = require('zod')

const createFacultySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  departmentCode: z.string().min(1).default('CSE'),
  employeeId: z.string().min(1),
  phone: z.string().optional().nullable()
}).passthrough()

const createStudentSchema = z.object({
  name: z.string().min(1),
  usn: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  departmentCode: z.string().min(1).default('CSE'),
  semester: z.number().int().min(1).max(8).default(1),
  phone: z.string().optional().nullable()
}).passthrough()

const rejectReasonSchema = z.object({
  reason: z.string().optional().nullable()
}).passthrough()

const updateSettingsSchema = z.object({
  key: z.string().min(1).optional(),
  value: z.string().optional(),
  settings: z.record(z.any()).optional()
}).passthrough()

const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  target: z.string().default('ALL'),
  targetDepartment: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL')
}).passthrough()

const confirmBulkSchema = z.object({
  type: z.enum(['students', 'faculty']),
  accounts: z.array(z.record(z.any())).min(1)
}).passthrough()

const overrideEnrollmentSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['VERIFIED', 'REJECTED', 'PENDING']),
  reason: z.string().min(1)
}).passthrough()

module.exports = {
  createFacultySchema,
  createStudentSchema,
  rejectReasonSchema,
  updateSettingsSchema,
  createAnnouncementSchema,
  confirmBulkSchema,
  overrideEnrollmentSchema
}
