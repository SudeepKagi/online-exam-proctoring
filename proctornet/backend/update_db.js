const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function update() {
  await prisma.faculty.updateMany({
    where: { email: { in: ['Sudeep@gmail.com', 'sudeep@gmail.com'] } },
    data: {
      idCardPhotoUrl: 'https://via.placeholder.com/300x200?text=Valid+ID+Card',
      profilePhotoUrl: 'https://via.placeholder.com/150?text=Face',
    }
  });
  
  await prisma.student.updateMany({
    where: { email: 'axiomexplainedyt@gmail.com' },
    data: {
      idCardPhotoUrl: 'https://via.placeholder.com/300x200?text=Valid+ID+Card',
      facePhotoUrl: 'https://via.placeholder.com/150?text=Face',
      faceMatchScore: 0.95
    }
  });
  console.log('Database updated manually.');
}

update().finally(() => prisma.$disconnect());
