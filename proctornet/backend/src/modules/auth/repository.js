const { prisma } = require('../../infra/postgres/client')

class AuthRepository {
  async findAdminByEmail(email) {
    return prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() }
    })
  }

  async findFacultyByEmail(email) {
    return prisma.faculty.findUnique({
      where: { email: email.toLowerCase().trim() }
    })
  }

  async findStudentByEmail(email) {
    return prisma.student.findUnique({
      where: { email: email.toLowerCase().trim() }
    })
  }

  async findUserAcrossRoles(email) {
    const cleanEmail = email.toLowerCase().trim()

    // 1. Admin
    const admin = await this.findAdminByEmail(cleanEmail)
    if (admin) return { user: admin, role: 'admin' }

    // 2. Faculty
    const faculty = await this.findFacultyByEmail(cleanEmail)
    if (faculty) return { user: faculty, role: 'faculty' }

    // 3. Student
    const student = await this.findStudentByEmail(cleanEmail)
    if (student) return { user: student, role: 'student' }

    return null
  }
}

module.exports = new AuthRepository()
