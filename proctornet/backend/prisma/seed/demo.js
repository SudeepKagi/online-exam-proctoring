require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function seedDemoData() {
  console.log('\n🌱 Seeding ProctorNet Demo accounts...\n')

  const commonPassword = 'Password@123'
  const hashed = await bcrypt.hash(commonPassword, 12)

  try {
    // 1. Seed Faculty
    const faculty = await prisma.faculty.upsert({
      where: { email: 'demo.faculty@proctornet.com' },
      update: { password: hashed, isApproved: true },
      create: {
        name: 'Dr. Demo Faculty',
        email: 'demo.faculty@proctornet.com',
        password: hashed,
        department: 'Computer Science',
        employeeId: 'F-12345',
        isApproved: true
      }
    })
    console.log('✅ Demo Faculty created: demo.faculty@proctornet.com')

    // 2. Seed Student
    const student = await prisma.student.upsert({
      where: { usn: '1VE22CS999' },
      update: { password: hashed, approvalStatus: 'APPROVED' },
      create: {
        name: 'Demo Student',
        usn: '1VE22CS999',
        email: 'demo.student@proctornet.com',
        password: hashed,
        department: 'Computer Science',
        semester: 6,
        facePhotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample',
        idCardPhotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample',
        faceMatchScore: 0.95,
        approvalStatus: 'APPROVED'
      }
    })
    console.log('✅ Demo Student created: 1VE22CS999')

    console.log('\n🚀 Demo seeding complete!')
    console.log('Use "Password@123" for both accounts.\n')

  } catch (error) {
    console.error('❌ Demo seed failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

seedDemoData()
