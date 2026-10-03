const { z } = require('zod')

const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(1, 'Password is required').max(255)
}).strict()

const registerStudentSchema = z.object({
  name: z.string().min(2).max(100),
  usn: z.string().min(3).max(50),
  email: z.string().email().max(255),
  password: z.string().min(6).max(255),
  departmentCode: z.string().min(2).max(16),
  semester: z.number().int().min(1).max(8)
}).strict()

module.exports = {
  loginSchema,
  registerStudentSchema
}
