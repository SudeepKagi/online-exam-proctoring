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

    // Concurrently query role tables in parallel to eliminate sequential round-trips
    const [admin, faculty, student] = await Promise.all([
      this.findAdminByEmail(cleanEmail),
      this.findFacultyByEmail(cleanEmail),
      this.findStudentByEmail(cleanEmail)
    ])

    if (admin) return { user: admin, role: 'admin' }
    if (faculty) return { user: faculty, role: 'faculty' }
    if (student) return { user: student, role: 'student' }

    return null
  }
}

module.exports = new AuthRepository()
