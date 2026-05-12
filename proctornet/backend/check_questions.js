const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const exam = await prisma.exam.findFirst({
    include: { questions: true }
  });
  console.log('Questions count:', exam.questions.length);
}

check().finally(() => prisma.$disconnect());
