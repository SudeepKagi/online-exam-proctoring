const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const exams = await prisma.exam.findMany();
  console.log(exams);
}

check().finally(() => prisma.$disconnect());
