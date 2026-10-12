const { z } = require('zod')

const createFacultySchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  departmentCode: z.string().max(32).optional(),
  department: z.string().max(64).optional(),
  employeeId: z.string().min(1).max(64),
  phone: z.string().max(32).optional().nullable()
}).strict()

const createStudentSchema = z.object({
  name: z.string().min(1).max(100),
  usn: z.string().min(1).max(64),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  departmentCode: z.string().max(32).optional(),
  department: z.string().max(64).optional(),
  semester: z.union([z.number(), z.string()]).transform(v => parseInt(v, 10)).default(1),
  phone: z.string().max(32).optional().nullable()
}).strict()

const rejectReasonSchema = z.object({
  reason: z.string().max(500).optional().nullable()
}).strict()

const updateSettingsSchema = z.object({
  key: z.string().min(1).max(64).optional(),
  value: z.string().max(2048).optional(),
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
}).strict()

const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(4000),
  target: z.string().default('ALL'),
  targetDepartment: z.string().max(32).optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL')
}).strict()

const bulkAccountItemSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().optional(),
  usn: z.string().optional(),
  employeeId: z.string().optional(),
  departmentCode: z.string().optional(),
  department: z.string().optional(),
  semester: z.union([z.number(), z.string()]).optional(),
  phone: z.string().optional().nullable()
}).strict()

const confirmBulkSchema = z.object({
  type: z.string().optional(),
  role: z.string().optional(),
  accounts: z.array(bulkAccountItemSchema).optional(),
  records: z.array(bulkAccountItemSchema).optional()
}).strict().refine(data => data.type || data.role, {
  message: "Either 'type' or 'role' is required"
}).refine(data => (Array.isArray(data.accounts) && data.accounts.length > 0) || (Array.isArray(data.records) && data.records.length > 0), {
  message: "Accounts list must not be empty"
})

const overrideEnrollmentSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['VERIFIED', 'REJECTED', 'PENDING']),
  reason: z.string().min(1).max(500)
}).strict()

const createDepartmentSchema = z.object({
  code: z.string().min(1).max(16),
  name: z.string().min(1).max(128)
}).strict()

module.exports = {
  createFacultySchema,
  createStudentSchema,
  rejectReasonSchema,
  updateSettingsSchema,
  createAnnouncementSchema,
  confirmBulkSchema,
  overrideEnrollmentSchema,
  createDepartmentSchema
}

