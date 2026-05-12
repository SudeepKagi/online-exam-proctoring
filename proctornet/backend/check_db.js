const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const faculty = await prisma.faculty.findMany({
    select: { email: true, idCardPhotoUrl: true, profilePhotoUrl: true, createdAt: true }
  });
  console.log('--- FACULTY ---');
  console.dir(faculty, { depth: null });

  const students = await prisma.student.findMany({
    select: { email: true, idCardPhotoUrl: true, facePhotoUrl: true, faceMatchScore: true, createdAt: true }
  });
  console.log('--- STUDENTS ---');
  console.dir(students, { depth: null });
}

check().finally(() => prisma.$disconnect());
