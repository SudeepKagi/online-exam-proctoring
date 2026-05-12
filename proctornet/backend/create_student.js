const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  const email = 'student@proctornet.com'
  const password = await bcrypt.hash('Student@2026', 10)
  const usn = '1VE22CS001'

  await prisma.student.upsert({
    where: { usn },
    update: {
      password,
      isSuspended: false,
      approvalStatus: 'APPROVED',
      email
    },
    create: {
      name: 'Demo Student',
      email,
      usn,
      password,
      department: 'Computer Science',
      semester: 4,
      facePhotoUrl: 'https://via.placeholder.com/150',
      idCardPhotoUrl: 'https://via.placeholder.com/300x200',
      faceMatchScore: 0.99,
      approvalStatus: 'APPROVED'
    }
  })
  console.log('Student created/updated: student@proctornet.com / Student@2026')
}

main().finally(() => prisma.$disconnect())
