const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const logs = await prisma.evidenceLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 10,
    select: {
      id: true,
      eventType: true,
      severity: true,
      timestamp: true,
      details: true,
      screenshotUrl: true,
      cameraFrameUrl: true,
      studentExam: {
        select: {
          student: {
            select: { name: true, usn: true }
          }
        }
      }
    }
  });
  console.log('Total evidence logs retrieved:', logs.length);
  for (const log of logs) {
    console.log(`Student: ${log.studentExam.student.name} (${log.studentExam.student.usn})`);
    console.log(`Event: ${log.eventType} | Severity: ${log.severity} | Time: ${log.timestamp}`);
    console.log(`Details: ${log.details}`);
    console.log(`Screenshot Present: ${log.screenshotUrl ? log.screenshotUrl.substring(0, 50) + '...' : 'null'}`);
    console.log(`Camera Frame Present: ${log.cameraFrameUrl ? log.cameraFrameUrl.substring(0, 50) + '...' : 'null'}`);
    console.log('----------------------------------------------------');
  }
}

check().finally(() => prisma.$disconnect());
