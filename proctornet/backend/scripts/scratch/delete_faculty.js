const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  await prisma.faculty.deleteMany({
    where: { email: 'Sudeep@gmail.com' }
  });
  console.log('Cleaned up incomplete Faculty record.');
}

clean().finally(() => prisma.$disconnect());
