const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testStart() {
  const examId = '230ea879-1919-4221-ab8f-8e5a6a8f4c2e';
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { questions: true }
  })
  if (!exam) return console.log('Exam not found');
  
  const now = new Date();
  console.log('Now:', now.toISOString());
  console.log('Start:', exam.startTime.toISOString());
  console.log('End:', exam.endTime.toISOString());
  
  if (now < new Date(exam.startTime)) {
    return console.log('403: Exam has not started yet');
  }
  if (now > new Date(exam.endTime)) {
    return console.log('403: Exam has ended');
  }
  console.log('Success, it should start!');
}

testStart().finally(() => prisma.$disconnect());
