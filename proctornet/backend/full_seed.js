const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting full database reset and seed...')

  // Delete everything in correct reverse-dependency order
  await prisma.platformSetting.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.invigilatorSession.deleteMany()
  await prisma.examResult.deleteMany()
  await prisma.collusionReport.deleteMany()
  await prisma.reverificationLog.deleteMany()
  await prisma.chatMessage.deleteMany()
  await prisma.evidenceLog.deleteMany()
  await prisma.identityVerification.deleteMany()
  await prisma.answer.deleteMany()
  await prisma.studentExam.deleteMany()
  await prisma.question.deleteMany()
  await prisma.exam.deleteMany()
  await prisma.student.deleteMany()
  await prisma.faculty.deleteMany()
  await prisma.admin.deleteMany()

  // 1. Create Admin
  const adminPassword = await bcrypt.hash('Admin@2026', 12)
  const admin = await prisma.admin.create({
    data: {
      name: 'ProctorNet Admin',
      email: 'admin@proctornet.com',
      password: adminPassword,
    }
  })
  
  console.log('✅ Admin account seeded.')

  // 2. Create Faculty
  const facultyPassword = await bcrypt.hash('Faculty@123', 10)
  const f1 = await prisma.faculty.create({
    data: {
      name: 'Dr. John Smith',
      email: 'dr.smith@proctornet.com',
      password: facultyPassword,
      department: 'Computer Science',
      employeeId: 'EMP001',
      isApproved: true,
    }
  })

  const f2 = await prisma.faculty.create({
    data: {
      name: 'Dr. Jane Doe',
      email: 'dr.jane@proctornet.com',
      password: facultyPassword,
      department: 'Electrical Engineering',
      employeeId: 'EMP002',
      isApproved: true,
    }
  })
  
  console.log('✅ Faculty accounts seeded.')

  // 3. Create Students
  const studentPassword = await bcrypt.hash('Student@123', 10)
  const students = []
  for (let i = 1; i <= 5; i++) {
    const s = await prisma.student.create({
      data: {
        name: `Student ${i}`,
        usn: `1VE22CS00${i}`,
        email: `student${i}@proctornet.com`,
        password: studentPassword,
        department: 'Computer Science',
        semester: 4,
        facePhotoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        idCardPhotoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        faceMatchScore: 0.95 + (i * 0.01),
        approvalStatus: i === 1 ? 'PENDING_FACULTY' : 'APPROVED',
      }
    })
    students.push(s)
  }
  
  console.log('✅ Student accounts seeded.')

  // 4. Create Exams
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
      status: 'ACTIVE',
      cameraRequired: true,
      micRequired: false,
      browserLock: true,
      fullScreenMode: true,
      watermarkRequired: true,
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
      status: 'DRAFT',
    }
  })

  // Add questions to the active exam
  await prisma.question.create({
    data: {
      examId: exam1.id,
      type: 'MCQ',
      questionText: 'What is the time complexity of binary search?',
      options: JSON.stringify(['O(1)', 'O(n)', 'O(log n)', 'O(n^2)']),
      correctAnswer: 'O(log n)',
      marks: 2,
    }
  })

  await prisma.question.create({
    data: {
      examId: exam1.id,
      type: 'SUBJECTIVE',
      questionText: 'Explain the difference between a stack and a queue.',
      marks: 5,
      wordLimitMin: 50,
      wordLimitMax: 200,
    }
  })
  
  console.log('✅ Exams seeded.')

  console.log('\n=============================================')
  console.log('🎉 Seeding Complete! Here are your credentials:')
  console.log('=============================================')
  
  console.log('\n👨‍💼 ADMIN:')
  console.log('Email:    admin@proctornet.com')
  console.log('Password: Admin@2026')
  
  console.log('\n👩‍🏫 FACULTY:')
  console.log('Email:    dr.smith@proctornet.com')
  console.log('Password: Faculty@123')
  console.log('Email:    dr.jane@proctornet.com')
  console.log('Password: Faculty@123')

  console.log('\n🎓 STUDENTS:')
  for (let i = 1; i <= 5; i++) {
    console.log(`USN:      1VE22CS00${i}`)
    console.log(`Password: Student@123`)
  }
  
  console.log('\n=============================================\n')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
