const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  await prisma.faculty.deleteMany({
    where: { email: { in: ['Sudeep@gmail.com', 'sudeep@gmail.com'] } }
  });
  await prisma.student.deleteMany({
    where: { email: 'axiomexplainedyt@gmail.com' }
  });
  console.log('Database cleaned. Old pending accounts removed.');
}

clean().finally(() => prisma.$disconnect());
