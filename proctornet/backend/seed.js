const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Clear existing non-admin data
  await prisma.studentExam.deleteMany()
  await prisma.exam.deleteMany()
  await prisma.student.deleteMany()
  // await prisma.faculty.deleteMany() // Keep the ones I just made in the browser subagent

  // 1. Create fake Faculty
  const facultyPassword = await bcrypt.hash('Faculty@123', 10)
  
  const f1 = await prisma.faculty.upsert({
    where: { email: 'dr.smith@proctornet.com' },
    update: {},
    create: {
      name: 'Dr. John Smith',
      email: 'dr.smith@proctornet.com',
      password: facultyPassword,
      department: 'Computer Science',
      employeeId: 'EMP001',
      isApproved: true
    }
  })

  const f2 = await prisma.faculty.upsert({
    where: { email: 'dr.jane@proctornet.com' },
    update: {},
    create: {
      name: 'Dr. Jane Doe',
      email: 'dr.jane@proctornet.com',
      password: facultyPassword,
      department: 'Electrical Engineering',
      employeeId: 'EMP002',
      isApproved: false
    }
  })

  // 2. Create fake Students
  const studentPassword = await bcrypt.hash('Student@123', 10)
  const students = []
  for (let i = 1; i <= 5; i++) {
    const s = await prisma.student.upsert({
      where: { usn: `1VE22CS00${i}` },
      update: {},
      create: {
        name: `Student ${i}`,
        usn: `1VE22CS00${i}`,
        email: `student${i}@proctornet.com`,
        password: studentPassword,
        department: 'Computer Science',
        semester: 4,
        facePhotoUrl: 'https://via.placeholder.com/150',
        idCardPhotoUrl: 'https://via.placeholder.com/300x200',
        faceMatchScore: 0.95 + (i * 0.01),
        approvalStatus: i === 1 ? 'PENDING_FACULTY' : 'APPROVED'
      }
    })
    students.push(s)
  }

  // 3. Create fake Exams
  const exam1 = await prisma.exam.create({
    data: {
      title: 'Data Structures Midterm',
      subject: 'CS401',
      description: 'Midterm examination for Data Structures',
      facultyId: f1.id,
      startTime: new Date(Date.now() - 3600000), // started 1 hr ago
      endTime: new Date(Date.now() + 3600000), // ends in 1 hr
      duration: 120,
      totalMarks: 50,
      questionsPerStudent: 10,
      invId: 'INV-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      invPasswordHash: await bcrypt.hash('Inv@123', 10),
      status: 'ACTIVE'
    }
  })

  const exam2 = await prisma.exam.create({
    data: {
      title: 'Operating Systems Quiz',
      subject: 'CS402',
      description: 'Short quiz',
      facultyId: f1.id,
      startTime: new Date(Date.now() + 86400000), // starts tomorrow
      endTime: new Date(Date.now() + 90000000),
      duration: 30,
      totalMarks: 20,
      questionsPerStudent: 20,
      invId: 'INV-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      invPasswordHash: await bcrypt.hash('Inv@123', 10),
      status: 'DRAFT'
    }
  })

  console.log('✅ Seed complete!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
