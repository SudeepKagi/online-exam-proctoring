const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function extendExam() {
  const now = new Date();
  
  // Extend all scheduled/active exams to end 2 hours from now
  // and start 1 hour ago
  const newStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hr ago
  const newEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hrs from now

  const res = await prisma.exam.updateMany({
    data: {
      startTime: newStart,
      endTime: newEnd,
      status: 'ACTIVE'
    }
  });

  console.log(`Updated ${res.count} exams.`);
  console.log(`New start: ${newStart.toISOString()}`);
  console.log(`New end: ${newEnd.toISOString()}`);
}

extendExam().finally(() => prisma.$disconnect());
