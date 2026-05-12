const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createActiveExam() {
  try {
    // Get demo faculty and student
    const faculty = await prisma.faculty.findUnique({ where: { email: 'demo.faculty@proctornet.com' } });
    const student = await prisma.student.findUnique({ where: { usn: '1VE22CS999' } });

    if (!faculty || !student) {
      console.log('Demo faculty or student not found.');
      return;
    }

    const hashedInvPassword = await bcrypt.hash('123456', 10);

    const exam = await prisma.exam.create({
      data: {
        title: 'Midterm Database Management',
        subject: 'DBMS',
        description: 'Testing Proctoring Features',
        facultyId: faculty.id,
        startTime: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
        endTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        duration: 60,
        totalMarks: 50,
        negativeMarking: false,
        questionsPerStudent: 5,
        allowedDepartments: ['Computer Science'],
        allowedSemesters: [6],
        invId: 'INV-' + Math.floor(Math.random() * 10000),
        invPasswordHash: hashedInvPassword,
        status: 'ACTIVE',
        questions: {
          create: [
            { type: 'MCQ', questionText: 'What is a primary key?', options: JSON.stringify([{text: 'Unique ID', isCorrect: true}, {text: 'Null value', isCorrect: false}]), marks: 10 },
            { type: 'MCQ', questionText: 'What is a foreign key?', options: JSON.stringify([{text: 'Links to PK', isCorrect: true}, {text: 'A random key', isCorrect: false}]), marks: 10 },
            { type: 'MCQ', questionText: 'Which is a NoSQL DB?', options: JSON.stringify([{text: 'MongoDB', isCorrect: true}, {text: 'MySQL', isCorrect: false}]), marks: 10 },
            { type: 'MCQ', questionText: 'ACID stands for?', options: JSON.stringify([{text: 'Atomicity, Consistency, Isolation, Durability', isCorrect: true}, {text: 'A, B, C, D', isCorrect: false}]), marks: 10 },
            { type: 'MCQ', questionText: 'SQL stands for?', options: JSON.stringify([{text: 'Structured Query Language', isCorrect: true}, {text: 'Standard Query Language', isCorrect: false}]), marks: 10 },
          ]
        }
      }
    });

    console.log('Created ACTIVE exam:', exam.title);

    // Create student exam record
    await prisma.studentExam.create({
      data: {
        studentId: student.id,
        examId: exam.id,
        watermarkSeed: 'WTR-' + student.usn,
        status: 'PENDING'
      }
    });

    console.log('Assigned exam to student:', student.usn);

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

createActiveExam();
