const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const questions = await prisma.question.findMany();
  console.log(JSON.stringify(questions, null, 2));
}

check().finally(() => prisma.$disconnect());
