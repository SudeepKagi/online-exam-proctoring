const { z } = require('zod')

const createFacultySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  departmentCode: z.string().optional(),
  department: z.string().optional(),
  employeeId: z.string().min(1),
  phone: z.string().optional().nullable()
}).passthrough()

const createStudentSchema = z.object({
  name: z.string().min(1),
  usn: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  departmentCode: z.string().optional(),
  department: z.string().optional(),
  semester: z.union([z.number(), z.string()]).transform(v => parseInt(v, 10)).default(1),
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
  type: z.string().optional(),
  role: z.string().optional(),
  accounts: z.array(z.record(z.any())).optional(),
  records: z.array(z.record(z.any())).optional()
}).passthrough().refine(data => data.type || data.role, {
  message: "Either 'type' or 'role' is required"
}).refine(data => (Array.isArray(data.accounts) && data.accounts.length > 0) || (Array.isArray(data.records) && data.records.length > 0), {
  message: "Accounts list must not be empty"
})

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
