#!/usr/bin/env bash
set -e
cd /opt/proctornet/current/backend
NODE_ENV=production node -r dotenv/config -e '
const { prisma } = require("./src/infra/postgres/client");
async function main() {
  const exams = await prisma.exam.findMany({
    select: { id: true, title: true, startTime: true, endTime: true, proctoringConfig: true, durationMinutes: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 5
  });
  console.log("=== RECENT EXAMS ===");
  console.log(JSON.stringify(exams, null, 2));

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true, email: true, name: true, status: true },
    take: 5
  });
  console.log("=== STUDENTS SAMPLE ===");
  console.log(JSON.stringify(students, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
' dotenv_config_path=/opt/proctornet/shared/.env
