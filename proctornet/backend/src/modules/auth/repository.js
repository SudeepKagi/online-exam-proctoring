const { prisma } = require('../../infra/postgres/client')

class AuthRepository {
  async findAdminByEmail(email) {
    return prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() }
    })
  }

  async findAdminById(id) {
    return prisma.admin.findUnique({
      where: { id }
    })
  }

  async findFacultyByEmail(email) {
    return prisma.faculty.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { department: true }
    })
  }

  async findFacultyById(id) {
    return prisma.faculty.findUnique({
      where: { id },
      include: { department: true }
    })
  }

  async findStudentByEmail(email) {
    return prisma.student.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { department: true }
    })
  }

  async findStudentByUsn(usn) {
    return prisma.student.findUnique({
      where: { usn: usn.toUpperCase().trim() },
      include: { department: true }
    })
  }

  async findStudentById(id) {
    return prisma.student.findUnique({
      where: { id },
      include: { department: true }
    })
  }

  async findExamById(examId) {
    return prisma.exam.findUnique({
      where: { id: examId }
    })
  }

  async createInvigilatorSession({ examId, invId, idCardPhotoKey, sessionExpiry, ipAddress }) {
    return prisma.invigilatorSession.create({
      data: {
        examId,
        invId,
        idCardPhotoKey: idCardPhotoKey || 'invigilator-id-verified',
        sessionExpiry,
        ipAddress,
        isActive: true
      },
      include: {
        exam: {
          select: { id: true, title: true, subject: true }
        }
      }
    })
  }

  async findInvigilatorSessionById(id) {
    return prisma.invigilatorSession.findUnique({
      where: { id },
      include: {
        exam: {
          select: { id: true, title: true, subject: true }
        }
      }
    })
  }

  async updateAdminPassword(id, hashedPassword) {
    return prisma.admin.update({
      where: { id },
      data: { password: hashedPassword }
    })
  }

  async updateFacultyPassword(id, hashedPassword) {
    return prisma.faculty.update({
      where: { id },
      data: { password: hashedPassword, mustChangePassword: false }
    })
  }

  async updateStudentPassword(id, hashedPassword) {
    return prisma.student.update({
      where: { id },
      data: { password: hashedPassword, mustChangePassword: false }
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
