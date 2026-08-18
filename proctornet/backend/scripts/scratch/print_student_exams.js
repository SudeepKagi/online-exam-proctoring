const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const studentExams = await prisma.studentExam.findMany({
    include: { student: true, exam: true }
  });
  console.log(studentExams);
}

check().finally(() => prisma.$disconnect());
